const _ = require('lodash');
const chalk = require('chalk');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { ne } = Op;
const log = require('log4js').getLogger('models'); // eslint-disable-line
log.level = 'debug';

module.exports = function (config, modules_config) {
    const DBConfig = config().db;
    const dbOptions = {
        port: DBConfig.port,
        host: DBConfig.host,
        dialect: DBConfig.dialect,
        logging: DBConfig.logging,
        operatorsAliases: 0,
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        }
    };
    if (DBConfig.dialectOptions) {
        dbOptions.dialectOptions = DBConfig.dialectOptions;
    }
    dbOptions.pool = DBConfig.pool;
    const sequelize = new Sequelize(
        DBConfig.database,
        DBConfig.username,
        DBConfig.password,
        dbOptions
    );

    const modelsFiles = _.compact(_.map(modules_config.modules, (module) => {
        return (module && module.parameters && module.parameters.model === true) ? `${module.module}/lib/model.js` : false
    }));

    const db = {};
    _
        .forEach(
            modelsFiles,
            file => {
                const models = require(`../../../${file}`)(sequelize);
                if (Array.isArray(models)) {
                    _.each(models, model => {
                        db[model.name] = model;
                    });
                } else {
                    db[models.name] = models;
                }
            }
        );

    return Promise.resolve(db)
};
