const _ = require('lodash');
const chalk = require('chalk');
const url = require('url');
const qs = require('qs');
const Joi = require('@hapi/joi');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const log = require('log4js').getLogger('cached');
log.level = 'debug';

module.exports = function (config, models) {
    const { currentEnvironment, environments } = config();
    const environment = environments[process.env.NODE_ENV === 'dev' ? 'development' : currentEnvironment];

    const upsertOrgid = async (organizationPayload) => {
        log.debug('[.]', chalk.blue('upsertOrgid') , JSON.stringify(organizationPayload));
        let orgid;
        try {
            orgid = await models.orgid.upsert(organizationPayload, { orgid: organizationPayload.orgid });
            log.debug('view created org');
        } catch (e) {
            log.warn('upsertOrgid error during orgid upsert:', e.toString());
            log.debug('upsertOrgid error during orgid upsert:', e);
            throw e.toString()
        }

        return orgid;
    };

    const updateOrgidData = async (orgid, data) => {
        return await models.orgid.update(data, {
            where: {
                orgid
            }
        });
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
        return models.orgid.findOne({where: {orgid: address}});
    };

    const getOrgIdsRaw = async (query) => {
        const { page, sort, ...where } = query;
        let order = [];
        if (sort) {
            order = sort.split(',').map((sortCriteria) => {
                let sortDirection = 'ASC';
                if(sortCriteria[0] === '-') {
                    sortDirection = 'DESC';
                    sortCriteria = sortCriteria.substr(1)
                }
                return [sortCriteria, sortDirection];
            })
        }
        if (where['parent.orgid']) {
            where.parent = {
                [Op.like]: `%${where['parent.orgid']}%`
            };
            delete where['parent.orgid'];
        }
        if (where.name) {
            if (where.name.length === 42 && where.name[0] === '0' && where.name[1] === 'x') {
                where[Op.or] = {
                    orgid: where.name,
                    parent: {
                        [Op.like]: `%${where.name}%`
                    },
                    owner: where.name
                };
                delete where.name;
            } else {
                where.name = {
                    [Op.like]: `%${where.name}%`
                }
            }
        }
        const limit = _.get(page, 'size', 25);
        const offset = (_.get(page, 'number', 1)-1) * limit;

        let { rows, count } = await models.orgid.findAndCountAll(
            {
                attributes: ['orgid', 'state', 'subsidiaries', 'parent', 'orgidType', 'directory', 'name', 'logo', 'proofsQty', 'owner', 'country'],
                where,
                order,
                offset,
                limit
            }
        );
        rows = _.map(rows, orgid => {
            orgid = orgid.get();
            orgid.type = 'orgid';
            return orgid;
        });
        return { rows, count };
    };

    const saveBlockNumber = (value = 0) => models.stats.upsert({
        name: 'blockNumber',
        value
    });

    const getBlockNumber = async () => {
        const record = await models.stats.findOne({
            where: {
                name: {
                    [Op.eq]: 'blockNumber'
                }
            }
        });
        const value = record && record.value ? Number(record.value) : 0;
        return String(value) !== 'NaN' ? value : 0;
    }

    // ??????? model `section` not defined
    const getSegments = async () => {
        let segments = await models.section.findAll();
        segments = _.map(segments, segment => {
            segment = segment.get();
            segment.type = 'segment';
            return segment;
        });

        return segments
    };

    const saveProfileDraft = async (json) => {
        const draft = await models.drafts.create({ json });
        return {
            profileId: draft.profileId,
            password: draft.password
        };
    };

    const updateProfileDraft = async (profileId, password, json) => {
        const draft = await models.drafts.findOne({ where: { profileId, password } });
        if (!draft) {
            const err = new Error('Profile not found');
            err.code = 404;
            throw  err;
        }
        return await draft.update({ json });
    };

    const removeProfileDraft = async (profileId, password) => {
        await models.drafts.destroy({ where: { profileId, password } });
    };

    const getProfileDraft = async profileId => {
        const draft = await models.drafts.findOne({ where: { profileId } });
        if (!draft) {
            const err = new Error('Profile not found');
            err.code = 404;
            throw  err;
        }
        return draft.json
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

    const extendWithPagination = async (query, selfUrl, rowCountPromise, querySchema) => {
        query = fillQuery(query);
        const { size, number: pageNumber } = query.page;
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
                self: selfUrl
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
        return json;
    };

    const getOrgIds = async (req) => {
        let query = typeof req.query === 'object' ? req.query : {};
        query = Object.assign({}, query, {
            state: query.state || true
        });

        if (query.all === 'true' || query['parent.orgid']) {
            delete query.state;
        }

        delete query.all;

        const pageSchema = {
            page: Joi.object({
                number: Joi.number(),
                size: Joi.number()
            })
        };
        const orgidsQuerySchema = Joi.object({
            'orgidType': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'directory': Joi.string().valid(...['hotel', 'airline', 'insurance', 'ota', 'legalEntity']),
            'name': Joi.string(),
            'owner': Joi.string().length(42), // Length of an Ethereum address with 0x prefix
            'country': Joi.string().length(2),
            'state': Joi.boolean(),
            'parent.orgid': Joi.string().length(66), // Length of an ORG.ID with 0x prefix
            'sort': Joi.string(), //?sort=primary-address.street-1,-name
            ...pageSchema
        });
        const getUrl = getUrlGenerator(req.protocol, req.get('host'), req.route ? req.baseUrl + req.route.path : req.baseUrl);
        const selfUrl = getUrl(query);

        query = fillQuery(query);
        const { size, number: pageNumber } = query.page;
        const where = orgidsQuerySchema ? validateJoiSchema(orgidsQuerySchema, query) : query;

        const { rows, count } = await getOrgIdsRaw(where);

        const lastPage = Math.ceil(count / size);
        const response = {
            meta: {
                page: pageNumber,
                per_page: size,
                total: count,
                pages: lastPage
            },
            links: {
                self: selfUrl
            },
            data: rows
        };
        if (pageNumber !== 1) {
            response.links.first = getUrl(_.extend(query, { page: { number: 1, size } }));
            response.links.prev = getUrl(_.extend(query, { page: { number: pageNumber - 1, size } }));
        }
        if (pageNumber !== lastPage) {
            response.links.last = getUrl(_.extend(query, { page: { number: lastPage, size } }));
            response.links.next = getUrl(_.extend(query, { page: { number: pageNumber + 1, size } }));
        }

        return response;
    };

    return Promise.resolve({
        upsertOrgid,
        updateOrgidData,
        getOrgId,
        getOrgIdRaw,
        getSegments,
        saveBlockNumber,
        getBlockNumber,
        saveProfileDraft,
        updateProfileDraft,
        removeProfileDraft,
        getProfileDraft,
        getOrgIdsRaw,
        getOrgIds,
        environment: () => environment
    });
};
