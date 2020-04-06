const Joi = require('@hapi/joi');
const express = require('express');
const router = express.Router();
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger(`${filenameSplitted[filenameSplitted.length - 3]}/${filenameSplitted[filenameSplitted.length - 1].replace('.js', '')}`);
log.level = 'debug';

module.exports = function (rest, cached) {
    const pageSchema = {
        page: Joi.object({
            number: Joi.number(),
            size: Joi.number()
        })
    };

    router.get('/orgids/:address', async (req, res) => {
        const {address} = req.params;
        const self = req.protocol + '://' + req.get('host') + req.originalUrl;
        try {
            const orgId = await cached.getOrgId(address);
            const json = {
                links: {
                    self,
                },
                data: {
                    type: 'orgid',
                    ...orgId
                }
            };
            res.status(200).send(json)
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.get('/orgids/owned/:ownerAddress', async (req, res) => {
        const { ownerAddress } = req.params;
        try {
            const orgIds = await cached.getOrgIds({owner: ownerAddress});
            res.status(200).send({data: orgIds})
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.get('/orgids', async (req, res) => {
        const orgidsQuerySchema = Joi.object({
            'orgidType': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'directory': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'name': Joi.string(),
            'owner': Joi.string().length(42), // Length of an Ethereum address with 0x prefix 
            'country': Joi.string().length(2),
            'parent.orgid': Joi.string().length(66), // Length of an ORG.ID with 0x prefix 
            'sort': Joi.string(), //?sort=primary-address.street-1,-name
            ...pageSchema
        });

        return rest.extendWithPagination(req, res, cached.getOrgIds, orgidsQuerySchema);
    });

    router.get('/segments', async (req, res) => {
        try {
            const segments = await cached.getSegments();
            res.status(200).send({data: segments})
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({})
};
