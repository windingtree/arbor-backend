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
        req.query = typeof req.query === 'object' ? req.query : {};
        req.query = Object.assign({}, req.query, {
            state: req.query.state || true
        });
        const orgidsQuerySchema = Joi.object({
            'orgidType': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'directory': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'name': Joi.string(),
            'owner': Joi.string().length(42), // Length of an Ethereum address with 0x prefix 
            'country': Joi.string().length(2),
            'state': Joi.boolean(),
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
            const basePath = environment.network === 'ropsten' ? 'staging.arbor.fm' : 'marketplace.windingtree.com';
            const msg = {
                to: req.body.email,
                from: 'noreply@windingtree.com',
                subject: 'Your Profile Draft on WindingTree marketplace',
                text: `Your organization is almost created!\n\n
                    We've saved your organization and created a draft of it on the Winding Tree Marketplace.\n
                    Now you need a desktop web browser with a MetaMask extension installed to continue creating a digital identity for your organization.\n\n
                    https://${basePath}/my-organizations?profileId=${profileId}`,
                html: `<!DOCTYPE html
                PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                <title>Your organization is almost created</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: white;
                        font-style: normal;
                        font-weight: 500;
                        font-size: 16px;
                        line-height: 28px;
                        color: #5E666A;
                    }
                    .content {
                        margin-top: 52px;
                    }
                    .pad {
                        width: auto;
                    }
                    .center {
                        width: 600px;
                        max-width: 600px;
                    }
                    .line {
                        width: 100%;
                        border-bottom: 2px solid #E3F9EB;
                    }
                    .logo {
                        
                    }
                    h1 {
                        font-family: Arial, Helvetica, sans-serif;
                        font-style: normal;
                        font-weight: 500;
                        font-size: 32px;
                        line-height: 52px;
                        color: #42424F;
                    }
                    .first {
                        margin-top: 52px;
                    }
                    .last {
                        margin-bottom: 52px;
                    }
                    .button {
                        display: flex;
                        flex-direction: row;
                        padding: 10px 20px;
                        border: 2px solid #3F4244;
                        box-sizing: border-box;
                        border-radius: 8px;
                        width: 217px;
                        height: 44px;
                        left: 80px;
                        top: 509px;
                        font-family: Arial, Helvetica, sans-serif;
                        font-style: normal;
                        font-weight: 600;
                        font-size: 16px;
                        line-height: 24px;
                        color: #3F4244;
                    }
                    a {
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td class="pad">&nbsp;</td>
                        <td class="center">
                            <div class="logo">
                                <img src="https://${basePath}/wlogo.png" />
                            </div>          
                        </td>
                        <td class="pad">&nbsp;</td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>
                            <h1>Your organization is almost created</h1>
                            <div class="line"></div>
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>
                            <p class="first">
                                We've saved your organization and created a draft of it on the Winding Tree Marketplace.
                            </p>
                            <p class="last">
                                Now you need a desktop web browser with a MetaMask extension installed to continue creating a digital identity for your organization.
                            </p>
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td>
                            <a href="https://${basePath}/my-organizations?profileId=${profileId}" target="_blank">
                                <div class="button">
                                    Go to My Organization
                                </div>
                            </a>
                        </td>
                        <td></td>
                    </tr>
                </table>
            </body>
            </html>`
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

    router.delete('/drafts/:profileId/:password', async (req, res) => {
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
