const Joi = require('@hapi/joi');
const express = require('express');
const router = express.Router();
const { verifyToken } = require('./utils');
// const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger('rest');
log.level = 'debug';

module.exports = function (rest, controller) {

    router.get('/stats/connection', async (req, res, next) => {
        try {
            const json = {
                connected: controller.isConnected(),
                reconnection: controller.isReconnection()
            };
            res.status(200).send(json);
        } catch (error) {
            return next(error);
        }
    });

    router.get('/rooms/hotel/:hotelId', async (req, res, next) => {
        const { hotelId } = req.params;

        try {
            const profile = await controller.fetchHotelProfile(hotelId);
            res.status(200).send(profile);
        } catch (error) {
            const externalError = new Error(error.message);
            externalError.code = 502;
            return next(externalError);
        }
    });

    router.post('/orgids/:address/refresh', async (req, res, next) => {
        const { address } = req.params;

        try {
            await controller.refreshOrganization(address);
            const orgId = await controller.cached.getOrgId(address);
            const self = req.protocol + '://' + req.get('host') + req.originalUrl;
            const json = {
                links: {
                    self,
                },
                data: {
                    type: 'orgid',
                    ...orgId
                }
            };
            res.status(200).send(json);
        } catch (error) {
            return next(error);
        }
    });

    router.post('/trustedPerson', async (req, res, next) => {
        const orgIdResolver = controller.orgIdResolver();
        const { token } = req.body;

        try {
            // Verify token
            const { payload } = await verifyToken(orgIdResolver, token);
            const { path } = await controller.storeIpfs(token);
            const savedPersons = await Promise.all(
                payload.sub.accounts.map(
                    account => controller.cached.saveTrustedPerson(
                        path,
                        payload.iss.split(':')[2],
                        payload.sub.name,
                        account.type,
                        account.value,
                        new Date(payload.exp * 1000)
                    )
                )
            );

            res.status(200).send(savedPersons);
        } catch (error) {
            switch (error.code) {
                case 'ERR_JWT_MALFORMED':
                    error.message = 'Token is malformed';
                    error.code = 403;
                break;
                default:
            }
            return next(error);
        }
    });

    router.get('/trustedPerson/orgId/:orgId', async (req, res, next) => {
        const {
            orgId
        } = req.params;
        try {
            const persons = await controller.cached.getPersonsByOrgId(orgId);
            res.status(200).send(persons);
        } catch (error) {
            return next(error);
        }
    });

    router.get('/trustedPerson/accountType/:type/:value', async (req, res, next) => {
        const {
            type,
            value
        } = req.params;
        try {
            const person = await controller.cached.getPersonByAccountType(
                type,
                value
            );
            res.status(200).send(person);
        } catch (error) {
            return next(error);
        }
    });

    router.get('/trustedPerson', async (req, res, next) => {
        try {
            const person = await controller.cached.getAllPersons();
            res.status(200).send(person);
        } catch (error) {
            return next(error);
        }
    });

    router.delete('/trustedPerson/:ipfs', async (req, res, next) => {
        const orgIdResolver = controller.orgIdResolver();
        const {
            ipfs
        } = req.params;
        try {
            await verifyToken(orgIdResolver, req.headers);
            await controller.removeIpfs(ipfs);
            await controller.cached.deletePersonByIpfsHash(ipfs);
            res.status(200).send('OK');
        } catch (error) {
            return next(error);
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({});
};
