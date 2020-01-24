const _ = require('lodash');
const chalk = require('chalk');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';
const fetch = require('node-fetch');
const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const OrganizationFactory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'OrganizationFactory');
const Organization = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'Organization');
const LifDeposit = Contracts.getFromNodeModules('@windingtree/trust-clue-lif-deposit', 'LifDeposit');
const Entrypoint = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'WindingTreeEntrypoint');
const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');

module.exports = function (config, cached) {

    const scrapeOrganization = async (orgAddress, segments, envName, providerAddress, lifDepositAddress) => {
        const res = {
            environment: envName,
            segments: segments,
            address: orgAddress,
        };

        // on-chain
        process.stdout.write('on-chain... ');
        const provider = new Web3.providers.HttpProvider(providerAddress);
        const web3 = new Web3(provider);
        const organization = await Organization.at(orgAddress);
        organization.setProvider(web3.currentProvider);
        try {
            res.orgid = await organization.address; //TODO review
            res.owner = await organization.methods.owner().call();
            res.orgJsonUri = await organization.methods.orgJsonUri().call();
            log.debug(res.orgJsonUri);
            res.orgJsonHash = await organization.methods.orgJsonHash().call();
            const createdBlock = await organization.methods.created().call();
            const resolvedBlock = await web3.eth.getBlock(createdBlock);

            res.dateCreated = resolvedBlock ? new Date(resolvedBlock.timestamp * 1000) : new Date();
            const associatedKeys = await organization.methods.getAssociatedKeys().call();
            associatedKeys.shift(); // remove zeroeth item
            res.associatedKeys = associatedKeys.join(',');

            // off-chain
            process.stdout.write('off-chain... ');
            let orgJsonResponse, orgJsonText;
            try {
                orgJsonResponse = await fetch(res.orgJsonUri);
                orgJsonText = await orgJsonResponse.text();
            } catch (e) {
                log.debug(e);

            }
            let orgJsonContent;
            try {
                orgJsonContent = JSON.parse(orgJsonText);
                res.orgJsonContent = orgJsonText;
            } catch (e) {
                console.warn(`Invalid json for org.id at ${orgAddress}`);
            }

            if (orgJsonContent) {
                if (orgJsonContent.updatedAt) {
                    res.dateUpdated = new Date(orgJsonContent.updatedAt);
                }

                if (orgJsonContent.legalEntity) {
                    res.name = orgJsonContent.legalEntity.name;
                    if (orgJsonContent.legalEntity.address) {
                        res.city = orgJsonContent.legalEntity.address.city;

                        const postal = orgJsonContent.legalEntity.address;
                        const postalAddressString = `${postal.houseNumber || ''} ${postal.road || ''}, ${postal.city || ''}, ${postal.postcode || ''}, ${postal.countryCode || ''}`;
                        /*const { gpsCoordsLat, gpsCoordsLon } = await findCoordinates(postalAddressString);
                        res.gpsCoordsLat = gpsCoordsLat;
                        res.gpsCoordsLon = gpsCoordsLon;*/
                    }
                }
            }

            // deposit
            process.stdout.write('lif-deposit... ');
            const deposit = LifDeposit.at(lifDepositAddress);
            deposit.setProvider(web3.currentProvider);
            res.lifDepositValue = await deposit.methods.getDepositValue(orgAddress).call();

            res.timestamp = new Date();

            process.stdout.write('res parsed');
        }
        catch (e) {
            log.debug(e);
        }
        log.info(JSON.stringify(res, null, 2));

        await cached.loadOrganizationIntoDB(res);


        //await Snapshot.upsert(res);

        log.debug('done.');

        return res;
    };

    const prepareToScrapeDirectory = async function (orgSegmentsIndex, segmentName, directoryAddress, providerAddress) {
        const provider = new Web3.providers.HttpProvider(providerAddress);
        const web3 = new Web3(provider);

        const directory = SegmentDirectory.at(directoryAddress);
        directory.setProvider(web3.currentProvider);

        const segment = await directory.methods.getSegment().call();
        console.log(`Preparing segment ${segment}`);
        const organizations = await directory.methods.getOrganizations().call();

        for (const orgAddress of organizations) {
            if (orgAddress !== '0x0000000000000000000000000000000000000000') {
                if (orgSegmentsIndex[orgAddress]) {
                    orgSegmentsIndex[orgAddress] = `${orgSegmentsIndex[orgAddress]},${segment}`;
                } else {
                    orgSegmentsIndex[orgAddress] = segment;
                }
            }
        }
    };

    const scrapeEnvironment = async (envName, environment) => {

        console.log(`Scraping environment ${envName}`);
        const provider = new Web3.providers.HttpProvider(environment.provider);
        const web3 = new Web3(provider);

        const entrypoint = await Entrypoint.at(environment.entrypoint);
        entrypoint.setProvider(web3.currentProvider);

        const segmentCount = await entrypoint.methods.getSegmentsLength().call();
        const orgSegmentsIndex = {};
        for (let i = 1; i < segmentCount; i++) {
            const segmentName = await entrypoint.methods.getSegmentName(i).call();
            const segmentAddress = await entrypoint.methods.getSegment(segmentName).call();
            if (segmentAddress !== '0x0000000000000000000000000000000000000000') {
                await prepareToScrapeDirectory(orgSegmentsIndex, segmentName, segmentAddress, environment.provider);
            }
        }
        for (const orgAddress in orgSegmentsIndex) {
            try {
                await scrapeOrganization(orgAddress, orgSegmentsIndex[orgAddress], envName, environment.provider, environment.lifDeposit);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const refreshProvider =  (web3Obj, providerUrl) => {
        let retries = 0;

        function retry(event) {
            if (event) {
                log.debug('Web3 provider disconnected or errored.');
                retries += 1;

                if (retries > 5) { //TODO: check if retry working
                    log.debug(`Max retries of 5 exceeding: ${retries} times tried`);
                    return setTimeout(refreshProvider, 5000)
                }
            } else {
                refreshProvider(web3Obj, providerUrl)
            }

            return null
        }

        const provider = new Web3.providers.WebsocketProvider(providerUrl);

        provider.on('end', () => {
                log.debug("Connection ended");
                retry()
            }
        );
        provider.on('error', () => retry());

        web3Obj.setProvider(provider);

        log.debug('New Web3 provider initiated');

        return provider
    };

    const setEntrypoint = async (envName, web3obj) => {
        if (!config().environments[envName]) {
            throw 'Unknown environment';
        }
        const environment = config().environments[envName];




        let wssProvider = refreshProvider(web3obj, `wss://ropsten.infura.io/ws/v3/${environment.infuraId}`);
        const entrypoint = await Entrypoint.at(environment.entrypoint);
        entrypoint.setProvider(wssProvider);
        return entrypoint
    };

    const listenEnvironmentEvents = async (envName) => {
        const web3 = await new Web3();
        const environment = config().environments[envName];
        const entrypoint = await setEntrypoint(envName, web3);
        let factory = await entrypoint.methods.getOrganizationFactory();
        debugger;
        let factoryCalled = await factory.call();
        const abi = OrganizationFactory.schema.abi;
        debugger;
        let contract = await new web3.eth.Contract(abi, factoryCalled);
        const currentBlock = await web3.eth.getBlockNumber();
        log.debug(`currentBlock: ${currentBlock}`);
        contract.events
            .allEvents(
                {
                    fromBlock: currentBlock
                },
                async (error, event) => {
                    /*
                    if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                        log.debug("Loaded OrgCreated event")
                    }*/
                    //log.debug(event);
                }
            )
            .on('data', async (event) => {
                log.debug("=================== Data ==========");
                if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                    let createdAddress = `0x${event.raw.topics[1].slice(-40)}`;
                    log.debug(`OrganizationCreated:${createdAddress}`);
                    const organization = await scrapeOrganization(createdAddress, 'test_segment', envName, environment.provider, environment.lifDeposit);
                } else {
                    log.debug("Not an OrganizationCreated event")
                }

                //log.debug(event);
            })
            .on('changed', (event) => {
                log.debug("=================== Changed ===================");
                log.debug(event);
            })
            .on('error', (error) => {
                log.debug(error);
            });


    };

    const listenOrganizationChangeEvents = async (envName, orgId) => {

        const web3 = await new Web3();
        const entrypoint = setEntrypoint(envName, web3);
        const environment = config().environments[envName];
        debugger;
        let contract = await new web3.eth.Contract(orgId);
debugger;
        const currentBlock = await web3.eth.getBlockNumber();
        log.debug(`currentBlockForOrg: ${currentBlock}`);
        contract.events
            .allEvents(
                {
                    fromBlock: currentBlock
                },
                async (error, event) => {
                    /*
                    if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                        log.debug("Loaded OrgCreated event")
                    }*/
                    //log.debug(event);
                }
            )
            .on('data', async (event) => {
                log.debug("=================== Data ==========");
                debugger;
               /* if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                    let createdAddress = `0x${event.raw.topics[1].slice(-40)}`;
                    log.debug(`OrganizationCreated:${createdAddress}`);
                    const organization = await scrapeOrganization(createdAddress, 'test_segment', envName, environment.provider, environment.lifDeposit);
                } else {
                    log.debug("Not an OrganizationCreated event")
                }
*/
                //log.debug(event);
            })
            .on('changed', (event) => {
                log.debug("=================== Changed ===================");
                log.debug(event);
            })
            .on('error', (error) => {
                log.debug(error);
            });


    };

    return Promise.resolve({
        scrapeEnvironment,
        scrapeOrganization,
        listenEnvironmentEvents,
        listenOrganizationChangeEvents,
        refreshProvider,
        visibleForTests: {
            scrapeOrganization,
            prepareToScrapeDirectory
        }
    });
};
