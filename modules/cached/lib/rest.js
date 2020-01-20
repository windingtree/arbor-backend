const express = require('express');
const router = express.Router();
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger(`${filenameSplitted[filenameSplitted.length-3]}/${filenameSplitted[filenameSplitted.length-1].replace('.js','')}`);
log.level = 'debug';

module.exports = function (rest, cached) {
    router.get('/stats', async (req, res) => {
        try {
            const stats = await cached.getStats();
            res.status(200).send({ data: stats });
        } catch (e) {
            const { code, json } = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.get('/orgids/:address', async (req, res) => {
        const { address } = req.params;
        try {
            const orgId = await cached.getOrgId(address);
            res.status(200).send({ data: { type: 'orgid', ...orgId } })
        } catch (e) {
            const { code, json } = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.get('/orgids', async (req, res) => {
        const filters = req.body;
        try {
            const orgIds = await cached.getOrgIds(filters);
            res.status(200).send({ data: orgIds })
        } catch (e) {
            const { code, json } = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.get('/segments', async (req, res) => {
        try {
            const segments = await cached.getSegments();
            res.status(200).send({ data: segments })
        } catch (e) {
            const { code, json } = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({})
};
