const express = require('express');
const router = express.Router();
const multer  = require('multer');
const upload = multer({ dest: 'uploads/tmp/' });
const url = require('url');
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger(`${filenameSplitted[filenameSplitted.length - 3]}/${filenameSplitted[filenameSplitted.length - 1].replace('.js', '')}`);
log.level = 'debug';

module.exports = function (rest, orgids_json) {
    const baseUrl = (req) =>  url.format({ protocol: req.protocol, host: req.get('host'), pathname: '/' });

    router.post('/json', async (req, res) => {
        const { address, orgidJson } = req.body;
        try {
            const uri = await orgids_json.saveJson(address, orgidJson, baseUrl(req));
            log.debug('json saved. uri', uri);
            const json = {
                data: {
                    type: 'uri',
                    uri
                }
            };
            res.status(200).send(json)
        } catch (e) {
            const {code, json} = rest.decorateError(e);
            return res.status(code).send(json)
        }
    });

    router.post('/media', upload.single('media'), async (req, res) => {
        try {
            console.log(req.body);
            console.log(req.file);

            const { body: { address, id }, file} =  req;

            const uri = await orgids_json.saveMedia('logo', { address, id, file }, baseUrl(req));
            log.debug('json saved. uri', uri);
            const json = {
                data: {
                    type: 'uri',
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
