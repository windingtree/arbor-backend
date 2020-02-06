const _ = require('lodash');
const chalk = require('chalk');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

module.exports = function (config, models) {
    const upsertOrgid = async (organizationPayload) => {
        log.debug('going to create orgid:');
        log.info(JSON.stringify(organizationPayload, null, 2));
        let orgid;
        try {
            orgid = await models.orgid.upsert(organizationPayload, { orgid: organizationPayload.orgid });
            log.info(JSON.stringify(orgid.get(), null, 2));
            log.debug('view created org');
        } catch (e) {
            log.debug(e.toString());
            log.debug(e);
            throw e.toString()
        }

        return orgid
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
        let orgid = await models.orgid.findOne({where: {orgid: address}});
        if (orgid) {
            orgid = orgid.get();
            orgid.type = 'orgid';
            orgid.orgJsonContent = orgid.orgJsonContent && orgid.orgJsonContent.toString ? orgid.orgJsonContent.toString() : orgid.orgJsonContent;
        }

        return orgid
    };

    const getOrgIdRaw = async (address) => {
        let orgid = await models.orgid.findOne({where: {orgid: address}});
        return orgid;
    };

    const getOrgIds = async (filters) => {
        let where = {};
        if (filters) {
            where = {...filters}
        }
        let orgids = await models.orgid.findAll({where});
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
            return segment;
        });

        return segments
    };

    return Promise.resolve({
        upsertOrgid,
        getStats,
        getOrgId,
        getOrgIdRaw,
        getOrgIds,
        getSegments
    });
};
