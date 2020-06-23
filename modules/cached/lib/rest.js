const Joi = require('@hapi/joi');
const express = require('express');
const router = express.Router();
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger('rest');
log.level = 'debug';
const sgMail = require('@sendgrid/mail');


module.exports = function (rest, cached) {
    const environment = cached.environment();
    sgMail.setApiKey(environment.sendgridApiKey);

    const pageSchema = {
        page: Joi.object({
            number: Joi.number(),
            size: Joi.number()
        })
    };

    router.get('/orgids/:address', async (req, res) => {
        const { address } = req.params;

        try {
            const orgId = await cached.getOrgId(address);
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
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            res.status(code).send(json);
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

    router.post('/drafts', async (req, res) => {
        try {
            const { profileId, password } = await cached.saveProfileDraft(req.body);
            const msg = {
                to: req.body.email,
                from: 'noreply@windingtree.com',
                subject: 'Your Profile Draft on WindingTree marketplace',
                text: `Your Profile Id: ${profileId}; password for updates: ${password}`,
                html: `Your Profile Id: ${profileId}; password for updates: ${password}`
            };
            await sgMail.send(msg);
            res.status(200).json({
                profileId
            });
        } catch (error) {
            const {code, json} = rest.decorateError(error);
            res.status(code).send(json);
        }
    });

    router.put('/drafts/:profileId/:password', async (req, res) => {
        const { profileId, password } = req.params;
        try {
            await cached.updateProfileDraft(profileId, password, req.body);
            res.status(200).send('OK');
        } catch (error) {
            const {code, json} = rest.decorateError(error);
            res.status(code).send(json);
        }
    });

    router.delete('/drafts/:profileId', async (req, res) => {
        const { profileId, password } = req.params;
        try {
            await cached.removeProfileDraft(profileId, password);
            res.status(200).send('OK');
        } catch (error) {
            const {code, json} = rest.decorateError(error);
            res.status(code).send(json);
        }
    });

    router.get('/drafts/:profileId', async (req, res) => {
        const { profileId } = req.params;
        try {
            const profile = await cached.getProfileDraft(profileId);
            res.status(200).json(profile);
        } catch (error) {
            const {code, json} = rest.decorateError(error);
            res.status(code).send(json);
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({})
};
