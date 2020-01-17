const _ = require('lodash');
const chalk = require('chalk');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

module.exports = function (config, models) {
    const loadOrganizationIntoDB = async (organizationPayload) => {
        // 1. Create database entry
        log.debug('going to create section');
        const organization = await models.orgid.create({
            ...organizationPayload
        });
        log.debug('view created org');
        log.info(JSON.stringify(organization.get(), null, 2));
        log.debug('====================================');
        /*
        // Find

        const section2 = await models.section.findOne({
            where: {
                id: '0x0',
            }
        });
        log.debug('view найденую section');
        log.info(JSON.stringify(section.get(), null, 2));
        log.debug('====================================');*/
        // process.exit(0);
    };


    return Promise.resolve({
        loadOrganizationIntoDB
    });
};
