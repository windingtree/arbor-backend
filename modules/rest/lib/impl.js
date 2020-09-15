const _ = require('lodash');
const log = require('log4js').getLogger('rest:server');
log.level = 'trace';
const express = require('express');
var app = require('express')();
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./logger');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
// const { Error } = require('sequelize');
const { version } = require('../../../package.json');
const proxy = require('express-http-proxy');
const rateLimit = require('express-rate-limit');

const error404 = message => {
    const error = new Error(message || 'Not Found');
    error.status = 404;
    return error;
};

const errorHandler = (error, req, res, next) => {
    let status;
    let errors;

    if (!Array.isArray(error)) {
        errors = [error];
        status = error.status || error.code || 500;
    } else {
        errors = error;
        status = 422;
    }

    const json = {
        errors: errors.map(e => {

            // Handle Sequelize errors
            if (e.sql && process.env.NODE_ENV !== 'dev') {
                e.message = 'Database Error';
            }

            return {
                message: e.message || 'Internal server error',
                status: e.status || e.code || 500,
                ...(req && req.path ? { path: req.path } : {}),
                ...(process.env.NODE_ENV === 'dev' ? { stack: e.stack } : {}),
                ...(process.env.NODE_ENV === 'dev' ? { details: e } : {})
            };
        })
    };
    log.error(JSON.stringify(json));
    res.status(status).json(json);
};

module.exports = cfg => {
    const config = cfg();
    const { currentEnvironment, environments } = config;
    const environment = environments[process.env.NODE_ENV === 'dev' ? 'development' : currentEnvironment];

    console.log(` ..: SNOWBALL :.. \r\n process.env.NODE_ENV ${process.env.NODE_ENV}\r\n`);

    app.set('trust proxy', 1);
    app.disable('x-powered-by');

    // Handle URI errors
    app.use((req, res, next) => {
        try {
            decodeURIComponent(req.path);
            next();
        } catch (error) {
            next(error);
        }
    });

    // Rate limiter
    const apiLimiterConfig = {
        windowMs: environment.limiterWindowMs,
        max: environment.limiterMax,
        message: 'Too many requests from this IP'
    };
    app.options('*', rateLimit(apiLimiterConfig));
    app.use(rateLimit(apiLimiterConfig));

    // Swagger docs.
    const swaggerDocument = YAML.load(path.resolve(__dirname, '../../../docs/swagger.yaml'));
    swaggerDocument.servers = [{ url: `https://${config.app.host}${(config.app.host && config.app.host !== 80) ? `:${config.app.host}` : ``}` }];
    swaggerDocument.info.version = version;
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Content type
    app.use((req, res, next) => {
        if(req.url.indexOf('mediaType') === -1){
            res.header('Content-Type', 'application/vnd.api+json');
        }
        res.header('Cache-control', 'no-store');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '-1');
        next();
    });

    //app.use(require('morgan')('dev'));
    app.use(require('body-parser').urlencoded({ limit: '50mb', extended: true }));
    app.use(require('body-parser').json({
        limit: '50mb',
        verify: (req, res, buf) => {
            req.rawBody = buf.toString('utf8');
        }
    }));

    // CORS
    const corsOptions = {
        origin: environment.corsAllowList || false,
        optionsSuccessStatus: 200,
        methods: 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
        allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
        exposedHeaders: 'Content-Range,X-Content-Range'
    };
    app.use(cors(corsOptions));

    app.use('/uploads', express.static('uploads'));

    // Simard proxy
    app.use('/simard', proxy(environment.simard, {
        https: true
    }));

    // Security headers
    app.use(helmet());
    app.use(
        helmet.hsts({
            maxAge: 31536000,
            includeSubDomains: true
        })
    );
    app.use(
        helmet.permittedCrossDomainPolicies({
          permittedPolicies: "master-only",
        })
    );
    app.use(
        helmet.contentSecurityPolicy({
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            blockAllMixedContent: [],
            fontSrc: ["'self'", "https:", "data:"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "https:"],
            upgradeInsecureRequests: []
          },
        })
    );

    const routers = [];
    const middlewares = [];

    const addRouter = router => routers.push(router);
    const addMiddleware = middleware => middlewares.push(middleware);

    const init = () => {
        _.each(middlewares, middleware => app.use(middleware));
        _.each(routers, router => app.use(router[0], router[1]));

        // Errors handling
        // should be at the end of all routes
        app.use(errorHandler);
        app.use((req, res) => errorHandler(error404('Path Not Found'), req, res));
    };

    // Start server
    const server = app.listen(config.app.port, () => {
        const host = server.address().address;
        const port = server.address().port;

        log.info('Server listening at http://%s:%s', host, port);
        logger.appStarted(config.app.port, config.app.host);
    });

    return Promise.resolve({
        addRouter,
        addMiddleware,
        init
    });
};
