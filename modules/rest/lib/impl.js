const _ = require('lodash');
const url = require('url');
const qs = require('qs');
const log = require('log4js').getLogger('rest:server');
log.level = 'trace';
const express = require('express');
var app = require('express')();
const cors = require('cors');
const fs = require('fs');
const logger = require('./logger');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { version } = require('../../../package.json');

// const appLogger = require('../../../utils/logger');
// const routeInitialize = require('../../../routes');


module.exports = function (cfg) {
    const config = cfg();

    console.log(` ..: SNOWBALL :.. \r\n process.env.NODE_ENV ${process.env.NODE_ENV}\r\n`);

    //config.app.sslOptions = {
    //    key: fs.readFileSync(`config/cert/${config.app.host}/privkey.pem`),
    //    cert: fs.readFileSync(`config/cert/${config.app.host}/fullchain.pem`)
    //};

    // eslint-disable-line no-unused-vars
    /*
    https.createServer(config.app.sslOptions, app).listen(config.app.port, // config.app.host, // (err) => {
        if (err) {
            return logger.error(err.message);
        }
        log.info('HTTP Server started on', config.app.host, 'and listen to', config.app.port, 'port.');
        logger.appStarted(config.app.port, config.app.host);
    });
    */

    var server = app.listen(config.app.port, function () {
        var host = server.address().address;
        var port = server.address().port;
        
        log.info("Server listening at http://%s:%s", host, port);
        logger.appStarted(config.app.port, config.app.host);
    });

    // app.logger = appLogger;
    
    app.options('*', cors());
    app.use(cors());
    app.use((req, res, next) => {
        if(req.url.indexOf('mediaType') === -1){
            res.header('Content-Type', 'application/vnd.api+json');
        }
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
        next();
    });

    //app.use(require('morgan')('dev'));
    app.use(require('body-parser').urlencoded({ limit: '50mb', extended: true }));
    app.use(require('body-parser').json({ limit: '50mb' }));

    app.use('/uploads', express.static('uploads'));

    // Swagger docs.
    const swaggerDocument = YAML.load(path.resolve(__dirname, '../../../docs/swagger.yaml'));
    swaggerDocument.servers = [{ url: `https://${config.app.host}${(config.app.host && config.app.host !== 80) ? `:${config.app.host}` : ``}` }];
    swaggerDocument.info.version = version;
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


    const routers = [];
    const middlewares = [];

    const addRouter = (router) => routers.push(router);
    const addMiddleware = (middleware) => middlewares.push(middleware);

    const init = () => {
        _.each(middlewares, middleware => app.use(middleware));
        _.each(routers, router => app.use(router[0], router[1]));
    };

    const decorateError = (e) => {
        let code = e.code || 500;
        let json = {
            errors: [{
                message: e.message || 'Internal server error',
                code
            }]
        };
        // if (e.code && e.title) {
        //     code = e.code;
        //     let error = _.pick(e, ['code', 'status', 'title', 'detail', 'source']);
        //     json = {
        //         errors: [error]
        //     };
        // } else {
        //     log.error(e);
        // }
        return { code, json }
    };

    const getUrlGenerator = (protocol, host, pathname) => (search) => {
        return url.format({
            protocol,
            host,
            pathname,
            search: qs.stringify(search)
        })
    };

    const DEFAULT_PAGE_SIZE = 25;

    const fillQuery = (query) => {
        if (typeof query.page !== 'object') return { ...query, page: { number:1, size: DEFAULT_PAGE_SIZE }};
        query.page.number = (!query.page.number) ? 1 : parseInt(query.page.number, 10);
        query.page.size =  (!query.page.size) ? DEFAULT_PAGE_SIZE : parseInt(query.page.size, 10);
        return query
    };

    const validateJoiSchema = (schema, data) => {
        const { error, value } = schema.validate(data);
        if (error) {
            const { details } = error;
            throw _.map(details, ({message, path}) => ({
                "status": 422,
                "title": "Invalid Attribute",
                "source": {
                    "pointer": path.join('/')
                },
                "detail": message
            }));
        }
        return value;
    };

    const extendWithPagination = async (req, res, rowCountPromise, querySchema) => {
        const query = fillQuery(req.query);
        const { size, number: pageNumber } = query.page;
        const getUrl = getUrlGenerator(req.protocol, req.get('host'), req.route ? req.baseUrl + req.route.path : req.baseUrl);
        const self = getUrl(query);
        try {
            const where = querySchema ? validateJoiSchema(querySchema, query) : query;

            const { rows, count } = await rowCountPromise(where);
            const lastPage = Math.ceil(count / size);
            const json = {
                meta: {
                    page: pageNumber,
                    per_page: size,
                    total: count,
                    pages: lastPage
                },
                links: {
                    self,
                },
                data: rows
            };
            if (pageNumber !== 1) {
                json.links.first = getUrl(_.extend(query, { page: { number: 1, size } }));
                json.links.prev = getUrl(_.extend(query, { page: { number: pageNumber - 1, size } }));
            }
            if (pageNumber !== lastPage) {
                json.links.last = getUrl(_.extend(query, { page: { number: lastPage, size } }));
                json.links.next = getUrl(_.extend(query, { page: { number: pageNumber + 1, size } }));
            }
            res.status(200).send(json)
        } catch (e) {
            if (!(e instanceof Error) && Array.isArray(e)) { // Joe Schema Validation
                return res.status(422).send({ errors: e });
            }

            const {code, json} = decorateError(e);
            return res.status(code).send(json)
        }
    };

    return Promise.resolve({
        addRouter,
        addMiddleware,
        init,
        decorateError,
        extendWithPagination
    });

};
