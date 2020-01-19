const log4js = require('log4js');
const log = require('log4js').getLogger('test');
log.level = 'trace';

log.info('dbManager init');

const { loadMainModuleSystem } = require('../../loadMainModules');
const loadOrganizationIntoDB = async function (org)

{
    const { config, models } = await loadMainModuleSystem();
    console.log(JSON.stringify(config().modificationTime, null, 2));

        // 1. Create database entry
        log.debug('going to create section');
        const organization = await models.orgid.create({
            ...org
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

module.exports = {
    loadOrganizationIntoDB
};
