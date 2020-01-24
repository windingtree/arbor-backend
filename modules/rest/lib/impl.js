const _ = require('lodash');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'trace';
const app = require('express')();
const cors = require('cors');
const fs = require('fs');
const logger = require('./logger');
const https = require('https');
const chalk = require('chalk');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { version, homepage } = require('../../../package.json');

// const appLogger = require('../../../utils/logger');
// const routeInitialize = require('../../../routes');


module.exports = function (cfg, models) {
    const config = cfg();

    console.log(` ..: SNOWBALL :.. \r\n process.env.NODE_ENV ${process.env.NODE_ENV}\r\n`);

    config.app.sslOptions = {
        key: fs.readFileSync(`config/cert/${config.app.host}/privkey.pem`),
        cert: fs.readFileSync(`config/cert/${config.app.host}/fullchain.pem`)
    };

    // eslint-disable-line no-unused-vars
    const server = https.createServer(config.app.sslOptions, app).listen(config.app.port, /* config.app.host, */ (err) => {
        if (err) {
            return logger.error(err.message);
        }
        log.info('HTTPS Server started on', config.app.host, 'and listen to', config.app.port, 'port.');
        logger.appStarted(config.app.port, config.app.host);
    });

    // app.logger = appLogger;
    app.options('*', cors());
    app.use(cors());
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
        next();
    });

    app.use(require('morgan')('dev'));
    app.use(require('body-parser').urlencoded({ limit: '50mb', extended: true }));
    app.use(require('body-parser').json({ limit: '50mb' }));

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
        let code = "500";
        let json = {
            errors: [{
                status: '500',
                title: 'Internal server error'
            }]
        };
        if (e.code && e.title) {
            code = e.code;
            let error = _.pick(e, ['code', 'status', 'title', 'detail', 'source']);
            json = {
                errors: [error]
            };
        } else {
            log.error(e);
        }
        return { code, json }
    };

    return Promise.resolve({
        addRouter,
        addMiddleware,
        init,
        decorateError
    });

};
