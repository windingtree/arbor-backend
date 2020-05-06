const _ = require('lodash');
const chalk = require('chalk');
// const crypto = require('crypto');
const { EventEmitter } = require('events');
const log = require('log4js').getLogger('events');
log.level = 'debug';

module.exports = function () {

    const ee = new EventEmitter();

    const on = (eventName, listener) => ee.on(eventName, (...args) => {
        try {
            return listener(...args);
        } catch (e) {
            log.warn(`${chalk.red('ERROR')}: Event catch error for ${chalk.red(eventName)}. Error:`, e);
        }
    });

    const emit = async (eventName, ...args) => {
        try {
            return ee.emit(eventName, ...args);
        } catch (e) {
            log.warn('prevent event double emit');
        }

    };

    return Promise.resolve({
        on,
        emit
    });
};
