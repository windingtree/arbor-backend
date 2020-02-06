const _ = require('lodash');
const chalk = require('chalk');
const Web3 = require('web3');
const commandLineArgs = require('command-line-args');
const { loadMainModuleSystem } = require('../../loadMainModules');

const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'trace';

const optionDefinitions = [
    { name: 'env', alias: 'e', type: String },
    { name: 'qty', alias: 'q', type: Number },
];
const cliOptions = commandLineArgs(optionDefinitions);

const { env, qty } = cliOptions;

const names = {
    legalEntity: require('./generative/legalEntityNames'),
    hotel: require('./generative/hotelNames'),
    airline: require('./generative/airlineNames'),
};

const addresses = require('./generative/address');

const alphabet = [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F'];
const x16 = () => alphabet[_.random(0,15)];
const random_address = () => '0x'+_.map(Array(40), () => x16()).join('');

const generateJSON = (type = "legalEntity") => {
    const addressString = _.sample(addresses);
    const addressObj = addressString.split(',');
    const country = _.trim(addressObj.pop());
    const postal_code = _.trim(addressObj.pop());
    const locality = _.trim(addressObj.pop());
    const city = _.trim(addressObj.pop());
    const street_address = addressObj.join(', ');


    const orgid_address = random_address();

    const entity = {
        [type === "legalEntity" ? "legalName" : "name"]: _.sample(names[type]),
        type,
        "locations": [{
            "name": "General",
            "address": {
                country,
                postal_code,
                locality,
                city,
                street_address
            }
        }],
        "contacts": [{
            "function": "General",
            "phone": "+1234567890",
            "email": "email@spam.com",
            "website": "test2.com",
            "facebook": "hiltonkyivhotel",
            "telegram": "acme.ny.reception",
            "twitter": "acme.ny.reception",
            "instagram": "acme.ny.reception",
            "linkedin": "acme.ny.reception"
        }]
    };

    return {
        "@context": "https://windingtree.com/ns/did/v1",
        "id": `did:orgid:${orgid_address}`,
        "orgid": orgid_address,
        "created": "2019-01-01T13:10:02.251Z",
        "updated": new Date().toJSON(),
        [type === "legalEntity" ? "legalEntity" : type]: entity,
        "trust": {
            "assertions": [
                {
                    "type": "domain",
                    "claim": "windingtree.com",
                    "proof": "dns"
                },
                {
                    "type": "domain",
                    "claim": "lif.windingtree.com",
                    "proof": "https://lif.windingtree.com/orgid.txt"
                },
                {
                    "type": "twitter",
                    "claim": "windingtree",
                    "proof": "https://twitter.com/windingtree/status/1225446490107207681"
                }
            ],
            "credentials": []
        },
    };
};

console.log(JSON.stringify(generateJSON('hotel', ), null, 2));


const generateEntity = (owner, parentOrgid) => {

};


const generatePayload = (owner, allowedTypes) => {
    const jsonContent = generateJSON(_.sample(allowedTypes));
    const keccak256 = Web3.utils.keccak256(jsonContent.toString());
    if (jsonContent.legalEntity) {
        jsonContent.entity = jsonContent.legalEntity;
        jsonContent.entity.name = jsonContent.legalEntity.legalName;
        jsonContent.entity.type = 'legalEntity';
    }
    const orgidType = jsonContent.entity.type;
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
        name: _.get(jsonContent.entity, 'name', undefined),
        country: _.get(jsonContent.entity, 'locations[0].address.country'),
        isWebsiteProved,
        isSslProved,
        isSocialFBProved,
        isSocialTWProved,
        isSocialIGProved,
        isSocialLNProved,
        proofsQty: _.compact([isWebsiteProved, isSslProved, isSocialFBProved, isSocialTWProved, isSocialIGProved, isSocialLNProved]).length,
    };
};

const generate = (structure) => {
    _.each(structure, async childs => {
        const owner = random_address();
        const { orgid } = await generateLegalEntity(owner);
        _.map(Array(childs), () => generateEntity(owner, orgid));

    })
};

//generate([0,1,4]);


(async () => {
    const {config, cached} = await loadMainModuleSystem();
    console.log(JSON.stringify(config().modificationTime, null, 2));



    const generateLegalEntity = (owner) => {
        const organizationPayload = generatePayload(owner, ['legalEntity']);
        organizationPayload.subsidiaries = [];

        return cached.upsertOrgid(organizationPayload);

        /*
            subsidiaries_orgids [need update on add/delete subsidiaries - smart contracts]
            subsidiaries_qty [need update on add/delete subsidiaries - smart contracts]
            parent_orgid
            parent_orgid_name [need update on parent change]
            parent_orgid_proofs_qty [need update on parent change]
        */
    };





    const owner = random_address();
    const orgid = await generateLegalEntity(owner);
    console.log(JSON.stringify(orgid.get(), null, 4));
    process.exit(0);
})();
