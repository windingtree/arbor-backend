const express = require('express');
const router = express.Router();
const url = require('url');
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger(`${filenameSplitted[filenameSplitted.length - 3]}/${filenameSplitted[filenameSplitted.length - 1].replace('.js', '')}`);
log.level = 'debug';

module.exports = function (rest, orgids_json) {
    router.post('/json', async (req, res) => {
        const { address, orgidJson } = req.body;
        console.log('POST:JSON', req.body, req.params);
        try {
            const uri = await orgids_json.saveJson(address, orgidJson, url.format({ protocol: req.protocol, host: req.get('host'), pathname: '/' }));
            console.log('uri', uri);
            const json = {
                data: {
                    type: 'url',
                    uri
                }
            };
            res.status(200).send(json)
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({})
};
