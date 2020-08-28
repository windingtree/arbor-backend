const express = require('express');
const router = express.Router();

module.exports = (rest, controller) => {
    const environment = controller.environment();
    const {
        handleStripeWebHook,
        getWalletBalance,
        getPaymentIntentStatus,
        estimateGasCostForMethod,
        createPaymentIntent
    } = controller;

    router.get('/balance', async (req, res) => {
        try {
            const balance = await getWalletBalance();
            res.status(200).json({ balance });
        } catch (error) {
            res.status(error.status || 500).json({
                error: error.message
            });
        }
    });

    router.get('/status/:paymentIntentId', async (req, res) => {
        try {
            const status = await getPaymentIntentStatus(req.params.paymentIntentId);
            res.status(200).json(status);
        } catch (error) {
            res.status(error.status || 500).json({
                error: error.message
            });
        }
    });

    router.post('/estimation', async (req, res) => {
        try {
            const {
                method,
                args,
                recipient
            } = req.body;
            if (!method) {
                return res.status(400).json({
                    error: 'Contract method must be defined in the request body'
                });
            }
            if (!args || !Array.isArray(req.body.args)) {
                return res.status(400).json({
                    error: 'Contract method arguments must be defined in the request body'
                });
            }
            if (!recipient) {
                return res.status(400).json({
                    error: 'Recipient must be defined in the request body'
                });
            }
            const {
                id,
                amount,
                currency,
                value,
                gasPrice
            } = await estimateGasCostForMethod(method, args, recipient);
            res.status(200).json({
                id,
                amount,
                currency,
                value,
                gasPrice
            });
        } catch (error) {
            console.log(error);
            res.status(error.status || 500).json({
                error: error.message
            });
        }
    });

    router.post('/intent/:estimationId', async (req, res) => {
        try {
            if (!req.params.estimationId) {
                return res.status(400).json({
                    error: 'Estimation Id must be provided'
                });
            }
            const paymentIntent = await createPaymentIntent(req.params.estimationId);
            res.status(200).json(paymentIntent);
        } catch (error) {
            res.status(error.status || 500).json({
                error: error.message
            });
        }
    });

    router.post('/webhook', async (req, res) => {
        const stripeSignature = req.headers['stripe-signature'];

        try {
            await handleStripeWebHook(req.rawBody, stripeSignature);
            res.status(200).json({ received: true });
        } catch (error) {
            res.status(error.status || 500).json({
                error: error.message
            });
        }
    });

    rest.addRouter(['/api/v1/stripe', router]);
    return Promise.resolve({});
};
