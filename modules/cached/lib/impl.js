const _ = require('lodash');
const chalk = require('chalk');
// const crypto = require('crypto');
const { EventEmitter } = require('events');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

module.exports = function () {
    return Promise.resolve({
    });
};
