const _ = require('lodash');
const chalk = require('chalk');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

module.exports = function (config, models) {
    const loadOrganizationIntoDB = async (organizationPayload) => {
        // 1. Create database entry
        log.debug('going to create orgid');
        const organizationInfo = {
            orgid: organizationPayload.address,
            environment: organizationPayload.environment,
            orgJsonUri: organizationPayload.orgJsonUri,
            orgJsonHash: organizationPayload.orgJsonHash,
            orgJsonContent: organizationPayload.orgJsonContent,
            dateCreated: organizationPayload.dateCreated,
            dateUpdated: organizationPayload.dateUpdated
        };
        log.debug('==================/==================');
        log.info(JSON.stringify(organizationInfo, null, 2));
        const organization = await models.orgid.create(organizationInfo);

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

    const getStats = async () => {
        return {
            type: 'stats',
            orgIdsQty: 50,
            sectionsQty: 2,
            dao_qty: 0
        }
    };

    const getOrgId = async () => {
        return {
            type: 'orgid',
        }
    };

    const getOrgIds = async () => {
        return [
            {
                type: 'orgid',
            },
            {
                type: 'orgid',
            }
        ]
    };

    const getSegments = async () => {
        return [
            {
                type: 'segment',
                name: 'hotels',
                address: '0x0'
            }
        ]
    };

    return Promise.resolve({
        loadOrganizationIntoDB,
        getStats,
        getOrgId,
        getOrgIds,
        getSegments
    });
};
