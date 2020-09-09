const _ = require('lodash');
const url = require('url');
const qs = require('qs');
const log = require('log4js').getLogger('rest:server');
log.level = 'trace';
const express = require('express');
var app = require('express')();
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const logger = require('./logger');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { version } = require('../../../package.json');
const proxy = require('express-http-proxy');
const rateLimit = require('express-rate-limit');

const error404 = message => {
    const error = new Error(message || 'Not Found');
    error.status = 404;
    return error;
};

const logErrors = (error, req, res, next) => {
    log.error(error);
    next(error);
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
        errors: errors.map(e => ({
            message: e.message || 'Internal server error',
            status: e.status || e.code || 500,
            ...(req && req.path ? { path: req.path } : {}),
            ...(process.env.NODE_ENV === 'dev' ? { stack: e.stack } : {})
        }))
    };
    res.status(status).json(json);
};

module.exports = function (cfg) {
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

    app.use('/uploads', express.static('uploads'));

    // Simard proxy
    app.use('/simard', proxy(environment.simard, {
        https: true
    }));

    // CORS
    const corsOptions = {
        origin: environment.corsAllowList || false,
        optionsSuccessStatus: 200,
        methods: 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
        allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept',
        exposedHeaders: 'Content-Range,X-Content-Range'
    };
    app.options('*', cors(corsOptions));
    app.use(cors(corsOptions));

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

    // Errors handling
    // app.use((req, res, next) => next(error404('Path Not Found')));
    app.use(logErrors);
    app.use(errorHandler);

    const routers = [];
    const middlewares = [];

    const addRouter = router => routers.push(router);
    const addMiddleware = middleware => middlewares.push(middleware);

    const init = () => {
        _.each(middlewares, middleware => app.use(middleware));
        _.each(routers, router => app.use(router[0], router[1]));
    };

    const getUrlGenerator = (protocol, host, pathname) => search => {
        return url.format({
            protocol,
            host,
            pathname,
            search: qs.stringify(search)
        })
    };

    const DEFAULT_PAGE_SIZE = 25;

    const fillQuery = query => {
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

    const extendWithPagination = async (req, res, rowCountPromise, querySchema, next) => {
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
            res.status(200).json(json);
        } catch (error) {
            return next(error);
        }
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
        init,
        extendWithPagination
    });
};
