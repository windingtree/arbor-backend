const express = require('express');
const router = express.Router();
const multer  = require('multer');
const didDocumentSchema = require('@windingtree/org.json-schema');
const Ajv = require('ajv');
const filenameSplitted = __filename.split(__filename[0]);
const log = require("log4js").getLogger(`${filenameSplitted[filenameSplitted.length - 3]}/${filenameSplitted[filenameSplitted.length - 1].replace('.js', '')}`);
log.level = 'debug';

const fileFilter = function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|json|JSON)$/)) {
        req.fileValidationError = 'Only images and JSON files are allowed!';
        return cb(new Error('Only image files and JSON are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({ dest: 'uploads/tmp/', fileFilter: fileFilter });


module.exports = function (rest, orgids_json) {
    const environment = orgids_json.environment();
    const baseUrl = environment.baseUrl;

    router.post('/json', async (req, res, next) => {
        try {
            const { address, orgidJson } = req.body;
            const validator = new Ajv();
            validator.validate(didDocumentSchema, orgidJson);

            if (validator.errors) {
                const validationError = new Error('ORG JSON Schema mismatch');
                validationError.status = 400;
                validationError.errors = validator.errors;
                throw validationError;
            }

            const uri = await orgids_json.saveJson(address, orgidJson, baseUrl);
            log.debug('json saved. uri', uri);
            const json = {
                data: {
                    type: 'uri',
                    uri
                }
            };
            res.status(200).json(json);
        } catch (error) {
            return next(error);
        }
    });

    router.post('/media', upload.single('media'), async (req, res, next) => {
        try {
            console.log(req.body);
            console.log(req.file);

            const { body: { address, id }, file} =  req;

            const uri = await orgids_json.saveMedia('logo', { address, id, file }, baseUrl);
            log.debug('json saved. uri', uri);
            const json = {
                data: {
                    type: 'uri',
                    uri
                }
            };
            res.status(200).send(json)
        } catch (error) {
            return next(error);
        }
    });

    rest.addRouter(['/api/v1/', router]);

    return Promise.resolve({})
};
