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
        try {
            const organization = await models.orgid.create(organizationInfo);
        } catch (e) {
            log.debug(e.toString());
            log.debug(e);
            throw e.toString()
        }

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
        let stats = await models.stats.findAll();
        stats = stats && stats.get ? stats.get() : stats;
        return {
            type: 'stats',
            ...stats
        }
    };

    const getOrgId = async (address) => {
        let orgid = await models.orgid.findOne({ where: { orgid: address }});
        if (orgid) {
            orgid = orgid.get();
            orgid.type = 'orgid';
            orgid.orgJsonContent = orgid.orgJsonContent && orgid.orgJsonContent.toString ? orgid.orgJsonContent.toString() : orgid.orgJsonContent;
        }

        return orgid
    };

    const getOrgIds = async (filters) => {
        let orgids = await models.orgid.findAll();
        orgids = _.map(orgids, orgid => {
            orgid = orgid.get();
            orgid.type = 'orgid';
            orgid.orgJsonContent = orgid.orgJsonContent && orgid.orgJsonContent.toString ? orgid.orgJsonContent.toString() : orgid.orgJsonContent;
            return orgid;
        });

        return orgids
    };

    const getSegments = async () => {
        let segments = await models.section.findAll();
        segments = _.map(segments, segment => {
            segment = segment.get();
            segment.type = 'segment';
            return orgid;
        });

        return segments
    };

    return Promise.resolve({
        loadOrganizationIntoDB,
        getStats,
        getOrgId,
        getOrgIds,
        getSegments
    });
};
