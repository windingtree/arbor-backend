const Sequelize = require('sequelize');
const axios = require('axios');
const moment = require('moment');
const Web3 = require('web3');
const Stripe = require('stripe');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const {
    OrgIdContract,
    addresses: OrgIdAddresses
} = require('@windingtree/org.id');
const log = require('log4js').getLogger('Stripe');
log.level = 'debug';

// const getNetworkNumber = network => {
//     switch (network) {
//         case 'ropsten':
//             return 3;
//         case 'mainnet':
//             return 1;
//         default:
//             throw new Error(`Unsupported Ethereum network: ${network}`);
//     }
// };

module.exports = (config, models) => {
    const { currentEnvironment, environments } = config();
    const environment = environments[
        process.env.NODE_ENV === 'dev'
            ? 'development'
            : currentEnvironment
    ];
    const provider = new HDWalletProvider(
        environment.wtWalletKey,
        environment.provider
    );
    const web3 = new Web3(provider);
    const stripe = Stripe(environment.stripeSecret);
    const stripeHookSecret = process.env.NODE_ENV === 'dev'
        ? environment.stripeHookSecretTest
        : environment.stripeHookSecret;

    // Returns a wallet balance
    const getBalance = async (address, toBN = true) => {
        const balance = await web3.eth.getBalance(address);
        return toBN
            ? web3.utils.toBN(balance)
            : balance;
    };

    // Promised timeout helper
    const setTimeoutPromise = timeout => new Promise(
        resolve => setTimeout(resolve, timeout)
    );

    // Returns a block
    const getBlock = async (web3, typeOrNumber) => {
        let counter = 0;
        let block;

        const blockRequest = () => new Promise(resolve => {
            const blockNumberTimeout = setTimeout(() => resolve(null), 2000);

            try {
                web3.eth.getBlock(typeOrNumber, (error, result) => {
                    clearTimeout(blockNumberTimeout);

                    if (error) {
                        return resolve(null);
                    }

                    resolve(result);
                });
            } catch (error) {
                // ignore errors due because of we will be doing retries
                resolve(null);
            }
        });

        // Sometimes provider can return wrong result
        // so we will do multiple tries
        do {
            if (counter === 30) {
                throw new Error(
                    `Unable to fetch block "${typeOrNumber}": retries limit has been reached`
                );
            }

            block = await blockRequest();

            if (!block) {
                // Increasing timeout before each time we going to start a new request
                await setTimeoutPromise(1000 + 1000 * parseInt(counter / 3));
            }

            counter++;
        } while (!block || block.transactions.length === 0);

        return block;
    };

    // Fetch current crypto price
    const fetchPrice = async (crypto = 'ethereum', fiat = 'usd') => {
        const result = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${crypto}&vs_currencies=${fiat}`,
            {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    accept: 'application/json'
                }
            }
        );

        return result.data[crypto][fiat];
    };

    // Build ether transfer transaction object
    const buildEtherTransferTransaction = (to, value, gasPrice) => ({
        from: environment.wtWallet,
        to,
        value,
        gasPrice
    });

    // Return an OrgId smart contract instance
    const getContract = () => new web3.eth.Contract(
        OrgIdContract.abi,
        OrgIdAddresses[environment.network]
    );

    // Total gas cost calculation for the smart contract transaction and ether transfer
    const estimateGasCostForMethod = async (method, args, recipient) => {
        let error;
        const amountUsed = await calculateAmountUsed(recipient);
        log.debug(`Amount paid before: ${amountUsed}`);

        // Check payments limit
        if (amountUsed > environment.fiatLimit) {
            error = new Error(`30-days payments limit in US$ ${environment.fiatLimit / 100} has been reached by the recipient`);
            error.status = 400;
            throw error;
        }

        const currency = 'usd';
        const contract = await getContract();

        // Validate inputs
        if (typeof contract.methods[method] !== 'function') {
            error = new Error(`Contract method '${method}' not found`);
            error.status = 400;
            throw error;
        }

        const abiArgs = OrgIdContract.abi.filter(m => m.name === method)[0].inputs;

        if (args.length !== abiArgs.length) {
            error = new Error(`Wrong set of the contract method arguments`);
            error.status = 400;
            throw error;
        }

        const etherscanResult = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${environment.etherscanKey}`);
        let gasPrice = web3.utils.toWei(etherscanResult.data.result.ProposeGasPrice, 'gwei');
        gasPrice = web3.utils.toBN(gasPrice);
        log.debug(`Estimated gas price: ${gasPrice.toString()}`);

        // Gas estimated for method execution
        let methodGas = await contract.methods[method]
            .apply(contract, args)
            .estimateGas({
                from: recipient,
                gasPrice
            });
        methodGas = web3.utils.toBN(methodGas);
        log.debug(`Estimated gas for method: ${methodGas.toString()}`);

        // Gas required for ether transfer
        let transferGas = await web3.eth.estimateGas(
            buildEtherTransferTransaction(
                recipient,
                methodGas,
                gasPrice
            )
        );
        transferGas = web3.utils.toBN(transferGas);
        log.debug(`Estimated gas for ether transfer: ${transferGas.toString()}`);

        // Total gas amount
        const totalGas = methodGas.add(transferGas);

        let gasCost = totalGas.mul(gasPrice);
        log.debug(`Estimated common gas cost: ${gasCost.toString()}`);
        // + 20%
        gasCost = gasCost
            .mul(web3.utils.toBN(120))
            .div(web3.utils.toBN(100));
        log.debug(`Estimated total gas cost: ${gasCost.toString()}`);
        const gasCostEther = web3.utils.fromWei(
            gasCost.toString(),
            'ether'
        );

        // Fetch ether rate
        let ethPrice = await fetchPrice('ethereum', currency);
        ethPrice = Math.ceil(Number(ethPrice) * 100);

        const estimation = await models.estimations.create(
            {
                recipient,
                method,
                args,
                amount: (Number(gasCostEther) * ethPrice / 100).toFixed(2),
                currency,
                value: gasCost.toString(),
                gasPrice: gasPrice.toString()
            }
        );

        return estimation;
    };

    // Save payment intent event object
    const setPaymentIntentCreated = async createEvent => {
        const paymentIntentId = createEvent.data.object.id;
        const recipient = createEvent.data.object.metadata.recipient;
        const value = createEvent.data.object.metadata.value;
        const gasPrice = createEvent.data.object.metadata.gasPrice;
        const payment = await models.payments.create(
            {
                paymentIntentId,
                recipient,
                value,
                gasPrice,
                createEvent
            }
        );
        return {
            paymentIntentId: payment.paymentIntentId
        };
    };

    // Fetch estimation by Id
    const getEstimationById = async id => {
        const estimation = await models.estimations.findOne(
            {
                where: {
                    id
                }
            }
        );

        let error;

        if (!estimation) {
            error = new Error(
                'Estimation not found'
            );
            error.status = 404;
            throw error;
        }

        return estimation;
    };

    // Fetch saved payment intent by its Id
    const getPaymentIntentById = async id => {
        const payment = await models.payments.findOne(
            {
                where: {
                    paymentIntentId: id
                }
            }
        );

        let error;

        if (!payment) {
            error = new Error(
                'Payment intent not found'
            );
            error.status = 404;
            throw error;
        }

        return payment;
    };

    // Save `cancelled` payment intent event and set record to the cancelled state
    const setPaymentIntentCancelled = async cancelEvent => {
        const paymentIntentId = cancelEvent.data.object.id;
        const payment = await getPaymentIntentById(paymentIntentId);

        let error;

        if (['refunded', 'succeeded'].includes(payment.state)) {
            error = new Error(
                'Payment intent in current state cannot be cancelled'
            );
            error.status = 400;
            throw error;
        }

        return payment.update(
            {
                cancelEvent,
                state: 'cancelled'
            }
        )
    };

    const calculateAmountUsed = async recipient => {
        const payments = await models.payments.findAll({
            where: {
                recipient,
                state: 'succeeded',
                createdAt: {
                    [Sequelize.Op.gte]: moment().subtract(30, 'days').toDate()
                }
            }
        });
        return payments.reduce(
            (a, { succeededEvent }) => a + succeededEvent.data.object.amount,
            0
        );
    };

    // Save `succeeded` payment intent event, starting value transfer
    // and set record to pending state
    const setPaymentIntentSucceeded = async succeededEvent => {
        log.debug(`"amount_capturable_updated" event: ${succeededEvent.id}`);
        const paymentIntentId = succeededEvent.data.object.id;
        const payment = await getPaymentIntentById(paymentIntentId);
        let error;

        if (['cancelled', 'refunded', 'succeeded'].includes(payment.state)) {
            error = new Error(
                'Payment intent in current state cannot be succeeded'
            );
            error.status = 400;
            throw error;
        }

        // Calculate total amount of payments including the last one
        const amount = succeededEvent.data.object.amount;
        const amountUsed = await calculateAmountUsed(payment.recipient);
        const totalAmount = amountUsed + amount;
        log.debug(`Amount paid before: ${amountUsed}`);

        // Check payments limit
        if (totalAmount > environment.fiatLimit) {
            await stripe.paymentIntents.cancel(paymentIntentId);
            error = new Error(
                `30-days payments limit in US$ ${environment.fiatLimit / 100} has been reached by the recipient`
            );
            error.status = 400;
            throw error;
        }

        const value = web3.utils.toBN(payment.value);
        const tx = buildEtherTransferTransaction(
            payment.recipient,
            value.toString(),
            payment.gasPrice
        );

        // Check WT wallet balance
        const wtBalance = await getBalance(environment.wtWallet);
        const gasCost = await web3.eth.estimateGas(tx);

        if (wtBalance.add(web3.utils.toBN(gasCost)).lt(value)) {
            // Insufficient WT wallet balance
            // Then cancel the payment and emit an error
            await stripe.paymentIntents.cancel(paymentIntentId);
            error = new Error(
                'Payment has been cancelled: service wallet has insufficient balance'
            );
            error.status = 400;
            throw error;
        }

        const errors = payment.errors || [];

        return new Promise(
            (resolve, reject) => {
                log.debug(`Starting Ether transaction: ${JSON.stringify(tx, null, 2)}`);
                web3.eth.sendTransaction(tx)
                    .on('transactionHash', async transactionHash => {
                        log.debug(`Ether sending transaction ${transactionHash} for the payment ${paymentIntentId}`);
                        try {
                            payment.update(
                                {
                                    succeededEvent,
                                    transactionHash
                                }
                            );
                            resolve(transactionHash);
                        } catch (err) {
                            log.error(`Error: ${err.message}`);
                            await payment
                                .update(
                                    {
                                        succeededEvent,
                                        state: 'errored',
                                        errors: [...errors, err.message]
                                    }
                                )
                                .catch(console.error);
                        }
                    })
                    .on('receipt', async ({ transactionHash }) => {
                        try {
                            log.debug(`Ether sent, starting payment capture: ${paymentIntentId}`);
                            await stripe.paymentIntents.capture(paymentIntentId);
                            log.debug(`Payment captured: ${paymentIntentId}`);
                            await payment.update(
                                {
                                    succeededEvent,
                                    transactionHash,
                                    state: 'succeeded'
                                }
                            );
                        } catch (err) {
                            log.error(`Error: ${err.message}`);
                            await payment
                                .update(
                                    {
                                        succeededEvent,
                                        state: 'errored',
                                        errors: [...errors, err.message]
                                    }
                                )
                                .catch(console.error);
                        }
                    })
                    .on('error', async error => {
                        try {
                            log.error(`sendTransaction error: ${error.message}`);
                            await stripe.paymentIntents.cancel(paymentIntentId);
                            const err = new Error(
                                `Payment has been cancelled: ${error.message}`
                            );
                            err.status = 400;
                            reject(err);
                            return;
                        } catch (err) {
                            log.error(`Error: ${err.message}`);
                            await payment
                                .update(
                                    {
                                        succeededEvent,
                                        state: 'errored',
                                        errors: [...errors, err.message]
                                    }
                                )
                                .catch(reject);
                            reject(err);
                        }
                    });
            }
        );
    };

    // Handle events from the Stripe
    const handleStripeWebHook = async (rawBody, stripeReqSignature) => {
        try {
            const event = stripe.webhooks.constructEvent(
                rawBody,
                stripeReqSignature,
                stripeHookSecret
            );

            // const event = JSON.parse(rawBody);

            if (!event.data.object.metadata.recipient) {
                return;
            }

            switch (event.type) {
                case 'payment_intent.created':
                    await setPaymentIntentCreated(event);
                    break;

                case 'payment_intent.amount_capturable_updated':
                    await setPaymentIntentSucceeded(event);
                    break;

                case 'payment_intent.canceled':
                    await setPaymentIntentCancelled(event);
                    break;

                default:
            }
        } catch (err) {
            console.log(err);
            const error = new Error(`Webhook Error: ${err.message}`);
            error.status = 400;
            throw error;
        }
    };

    // Returns a system wallet balance
    const getWalletBalance = async () => getBalance(environment.wtWallet, false);

    // Get payment intent status
    const getPaymentIntentStatus = async paymentIntentId => {
        const payment = await getPaymentIntentById(paymentIntentId);
        return {
            state: payment.state,
            transactionHash: payment.transactionHash,
            errors: payment.errors
        };
    };

    // Create payment intent using Stripe API
    const createPaymentIntent = async estimationId => {
        const estimation = await getEstimationById(estimationId);

        // Creating of payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: parseInt(estimation.amount * 100),
            currency: estimation.currency,
            payment_method_types: ['card'],
            capture_method: 'manual',
            metadata: {
                recipient: estimation.recipient,
                value: estimation.value,
                gasPrice: estimation.gasPrice
            }
        });

        return paymentIntent;
    };

    return Promise.resolve({
        environment: () => environment,
        handleStripeWebHook,
        getWalletBalance,
        getPaymentIntentStatus,
        estimateGasCostForMethod,
        createPaymentIntent
    });
};
