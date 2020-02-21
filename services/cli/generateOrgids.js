const _ = require('lodash');
const Web3 = require('web3');
const commandLineArgs = require('command-line-args');
const { loadMainModuleSystem } = require('../../loadMainModules');
const randomWords = require('random-words');

const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'trace';

const optionDefinitions = [
    { name: 'owner', alias: 'o', type: String }
];
const cliOptions = commandLineArgs(optionDefinitions);

const { owner } = cliOptions;

const capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1)
};

const names = {
    legalEntity: require('./generative/legalEntityNames'),
    hotel: require('./generative/hotelNames'),
    airline: require('./generative/airlineNames'),
    ota: require('./generative/ota'),
    insurance: require('./generative/insurance'),
};

const addresses = require('./generative/address');

const alphabet = [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F'];
const x16 = () => alphabet[_.random(0,15)];
const random_address = () => '0x'+_.map(Array(40), () => x16()).join('');
const random_id = () => Web3.utils.keccak256(`${Date.now()}`);
const random_phone = () => '+44' + _.map(Array(10), () => x16()).join('');


const generateJSON = (type = "legalEntity") => {
    const addressString = _.sample(addresses);
    const addressObj = addressString.split(',');
    const country = _.trim(addressObj.pop());
    const postal_code = _.trim(addressObj.pop());
    const subdivision = _.trim(addressObj.pop());
    const locality = _.trim(addressObj.pop());
    const street_address = addressObj.join(', ');
    const premise = (Math.random() < 0.2) ? "c/o Sielva Management SA" : undefined;



    const orgid_address = random_id();
    const socialName = randomWords({exactly:1, wordsPerString:2, separator:'-'})[0];

    const entity = {
        [type === "legalEntity" ? "legalName" : "name"]: _.sample(names[type]),
        type,
        "locations": [{
            "name": "General",
            "address": {
                country,
                subdivision,
                locality,
                postal_code,
                street_address,
                premise
            }
        }],
        "contacts": [{
            "function": "General"
        }]
    };

    if (type === "legalEntity") {
        _.extend(entity, {
            "legalIdentifier": `${country}-415.029.859`,
            "identifiers": [
                {
                    "type": "Commercial register number",
                    "value": `${country}-170.7.000.838-1`
                }
            ],
            "legalForm": _.sample(['private entrepreneur', 'private company limited by shares or Ltd. (UK, Ireland and the Commonwealth)', 'public limited company (UK, Ireland and the Commonwealth)', 'limited partnership', 'unlimited partnership', 'chartered company', 'statutory company', 'holding company', 'subsidiary company', 'one man company (sole proprietorship)', 'charitable incorporated organisation (UK)', 'non-governmental organization',]),
            "registeredAddress": {
                country,
                subdivision,
                locality,
                postal_code,
                street_address,
                premise
            },
        })
    } else {
        _.extend(entity, {
            "description": capitalize(randomWords({ min: 7, max: 15 }).join(' '))+'.',
            "longDescription": [
                capitalize(randomWords({ min: 7, max: 20 }).join(' ')),
                capitalize(randomWords({ min: 7, max: 20 }).join(' ')),
                capitalize(randomWords({ min: 7, max: 20 }).join(' ')),
                capitalize(randomWords({ min: 7, max: 20 }).join(' ')),
                capitalize(randomWords({ min: 7, max: 20 }).join(' ')),
            ].join('. ')+'.',
        })
    }

    const socialRandom = {
        'phone': { probability: 0.5, pattern: 'phone', position: 'phone' },
        'email': { probability: 0.5, pattern: '@example.com', position: 'before' },
        'website': { probability: 0.5, pattern: '.com', position: 'before' },
        'facebook': { probability: 0.4, pattern: 'https://facebook.com/', position: 'after' },
        'telegram': { probability: 0.1, pattern: 'https://t.me/', position: 'after' },
        'twitter': { probability: 0.3, pattern: 'https://twitter.com/', position: 'after' },
        'instagram': { probability: 0.45, pattern: 'https://instagram.com/', position: 'after' },
        'linkedin': { probability: 0.4, pattern: 'https://linkedin.com/', position: 'after' }
    };

    const jsonContent = {
        "@context": "https://windingtree.com/ns/did/v1",
        "id": `did:orgid:${orgid_address}`,
        "orgid": orgid_address,
        "created": "2019-01-01T13:10:02.251Z",
        "updated": new Date().toJSON(),
        "trust": {
            "assertions": [
            ],
            "credentials": []
        },
    };

    _.each(socialRandom, ({probability, pattern, position}, socialType) => {
        if (Math.random() <= probability){
            switch (position) {
                case 'before': entity.contacts[0][socialType] = `${socialName}${pattern}`; break;
                case 'after': entity.contacts[0][socialType] = `${pattern}${socialName}`; break;
                case 'custom': entity.contacts[0][socialType] = random_phone(); break;
            }
            if (!['email', 'phone', 'telegram'].includes(socialType) && Math.random() < 0.5) {
                jsonContent.trust.assertions.push({
                    type: ( socialType === 'website') ? 'domain' : socialType,
                    claim: entity.contacts[0][socialType],
                    proof: ( socialType === 'website') ? 'dns' : `${entity.contacts[0][socialType]}/post/12341234421345123`
                })
            }
        }
    });

    jsonContent[type === "legalEntity" ? "legalEntity" : 'organizationalUnit'] = entity;

    return jsonContent;
};

const generatePayload = (owner, allowedTypes) => {
    const orgidType = _.sample(allowedTypes);
    const entityType = orgidType === 'legalEntity' ? 'legalEntity' : 'organizationalUnit';
    const jsonContent = generateJSON(orgidType);
    const keccak256 = Web3.utils.keccak256(jsonContent.toString());
    const name = (orgidType === 'legalEntity') ? jsonContent.legalEntity.legalName : jsonContent.organizationalUnit.name;
    const { orgid, created: jsonCheckedAt, updated: jsonUpdatedAt } = jsonContent;
    const isWebsiteProved = !!_.filter(_.get(jsonContent, 'trust.assertions'), ['type', 'domain'])[0];
    const isSslProved = Math.random() > 0.9;
    const isSocialFBProved = !!_.filter(_.get(jsonContent, 'trust.assertions'), ['type', 'facebook'])[0];
    const isSocialTWProved = !!_.filter(_.get(jsonContent, 'trust.assertions'), ['type', 'twitter'])[0];
    const isSocialIGProved = !!_.filter(_.get(jsonContent, 'trust.assertions'), ['type', 'instagram'])[0];
    const isSocialLNProved = !!_.filter(_.get(jsonContent, 'trust.assertions'), ['type', 'linkedin'])[0];

    return {
        owner,
        orgid,
        orgidType,
        keccak256,
        jsonUri: `https://my-personal-site.com/${orgid}.json`,
        jsonContent,
        jsonCheckedAt,
        jsonUpdatedAt,
        name,
        country: _.get(jsonContent[entityType], 'locations[0].address.country'),
        isWebsiteProved,
        isSslProved,
        isSocialFBProved,
        isSocialTWProved,
        isSocialIGProved,
        isSocialLNProved,
        proofsQty: _.compact([isWebsiteProved, isSslProved, isSocialFBProved, isSocialTWProved, isSocialIGProved, isSocialLNProved]).length,
    };
};

(async () => {
    const {config, cached} = await loadMainModuleSystem();
    console.log(JSON.stringify(config().modificationTime, null, 2));

    const generateLegalEntity = (owner) => {
        const organizationPayload = generatePayload(owner, ['legalEntity']);
        organizationPayload.subsidiaries = [];
        return cached.upsertOrgid(organizationPayload);
    };

    const generateEntity = (owner, parent) => {
        const organizationPayload = generatePayload(owner, ['hotel', 'airline', 'ota', 'insurance']);
        organizationPayload.parent = parent;
        return cached.upsertOrgid(organizationPayload);
    };

    const generate = async (structure, masterOwner) => {
        await Promise.all(_.map(structure, async childs => {
            const owner = masterOwner ? masterOwner : random_address();
            const mainOrg = await generateLegalEntity(owner);
            const { orgid, name, proofsQty } = mainOrg;
            const subsidiaries = await Promise.all(_.map(Array(childs), async () => {
                const { orgid: subOrgid } = await generateEntity(owner, { orgid, name, proofsQty });
                return subOrgid;
            }));
            await mainOrg.update({ subsidiaries })
        }));
    };

    await generate([0,1,4], owner);

    process.exit(0);
})();
