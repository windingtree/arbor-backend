const _ = require('lodash');
const fs = require('fs');
const watchfs = _.extend({}, { watcher: require('node-watch') }); // hard hack, need for 2 realisations of config.js
const path = require('path');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
const aggregator_config_filename = path.join((process.env['APP_CONF'] || __dirname), '/config_aggregator.json');

log.info(`FROM MODULE:Reading config file from: '${aggregator_config_filename}'.`);

let config = {};
const defer = {};
defer.promise = new Promise((resolve, reject) => {
    defer.resolve = resolve;
    defer.reject = reject;
});

const ninvoke = async (className, methodName, ...args) => {
    return new Promise((resolve, reject) => {
        className[methodName](...args, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

const files_to_watch = [];

const update_config = (data, modificationTime) => {
    let temp_config = {};
    let isValid = true;
    const duplicate_fields = [];
    _.each(data, (obj) => {
        temp_config = _.defaults(temp_config, obj);
    });
    _.each(temp_config, (element, name) => {
        let counter = 0;
        _.each(data, (config_chunk) => {
            if (!_.isUndefined(config_chunk[name])) {
                counter++;
            }
        });
        if (counter > 1) {
            isValid = false;
            duplicate_fields.push(name);
        }
    });
    if (isValid) {
        config = temp_config;
        config.modificationTime = modificationTime;
    } else {
        throw Error(`Configuration files duplicate fields: ${duplicate_fields.join(', ')}`);
    }
};

/**
 * check if all parameters in config_filename match with their templates in expected_config_filename
 * @param config_filename
 * @param expected_config_filename
 * throw an error if the mismatch is found
 */
const checkConfig = (config_filename, expected_config_filename) => {
    const configValue = require(config_filename);
    const configRegular = require(expected_config_filename);
    const checkParameter = (parameter, value, regular, path) => {
        if (typeof regular === 'object' && regular !== null) {
            const subParameters = Object.keys(regular);
            for (let i = 0; i < subParameters.length; i++) {
                const subPath = `${path}.${subParameters[i]}`;
                if (value[subParameters[i]] === undefined) {
                    log.error(`no key '${subPath}' in ${config_filename}`);
                    throw new Error(`no key '${subPath}' in ${config_filename}`);
                }
                checkParameter(subParameters[i], value[subParameters[i]], regular[subParameters[i]], subPath);
            }
            return;
        }
        const parameterValue = `${value}`;
        const parameterRegular = new RegExp(regular);
        if (!parameterValue.match(parameterRegular)) {
            log.error(`wrong value for key '${path}' in ${config_filename}`);
            throw new Error(`wrong value for key '${path}' in ${config_filename}`);
        }
        if (parameterValue.match(parameterRegular)[0] !== parameterValue) {
            log.error(`wrong value for key '${path}' in ${config_filename}`);
            throw new Error(`wrong value for key '${path}' in ${config_filename}`);
        }
    };
    const configParameters = Object.keys(configRegular);
    for (let i = 0; i < configParameters.length; i++) {
        if (configValue[configParameters[i]] === undefined) {
            log.error(`no key '${configParameters[i]}' in ${config_filename}`);
            throw new Error(`no key '${configParameters[i]}' in ${config_filename}`);
        }
        checkParameter(configParameters[i], configValue[configParameters[i]], configRegular[configParameters[i]], configParameters[i]);
    }
};

const on_change = () => {
    let files_to_watch = [];
    return ninvoke(fs, 'readFile', aggregator_config_filename, {encoding: 'utf8'})
        .then((configs) => {
            let promises = [];
            const files = JSON.parse(configs);
            _.each(files, (filename) => {
                const full_filename = path.join((process.env['APP_CONF'] || __dirname), `/${filename}`);
                const full_expectedConfigName = path.join((process.env['APP_CONF'] || __dirname), `/expected_${filename}`);
                checkConfig(full_filename, full_expectedConfigName);
                promises.push(
                    ninvoke(fs, 'readFile', full_filename, {encoding: 'utf8'})
                );
                files_to_watch.push(full_filename);
            });
            promises.push(ninvoke(fs, 'stat', aggregator_config_filename));
            return Promise.all(promises);
        })
        .then(function (config_chunks) {
            const modification_time = getModificationTime(config_chunks.splice(-1)[0]);
            const data = [];
            _.each(config_chunks, (config_chunk) => data.push(JSON.parse(config_chunk)));
            update_config(data, modification_time);
        })
        .catch(function (error) {
            defer.reject(`Configuration changes were not applied. Error: ${error}`);
        });
};

const getModificationTime = (obj) => new Date(obj.mtime).getTime();

const getConfig = () => config;

const init = () => {
    files_to_watch.push(aggregator_config_filename);
    on_change()
        .then(() => {
            _.each(files_to_watch, (filename) => {
                watchfs.watcher(filename, on_change);
            });
            log.info('FROM MODULE:End configuration change.');
            defer.resolve(getConfig);
        })
        .catch((error) => {
            defer.reject(`Configuration changes were not applied. Error: ${error}`);
        });
};

if (typeof test_flag === 'undefined') {
    init();
}

module.exports = function () {
    return defer.promise;
};
