const _ = require('lodash');
const chalk = require('chalk');
const fetch = require('node-fetch');
const dns = require('dns');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

// SMART CONTRACTS
const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const OrgId = Contracts.getFromNodeModules('@windingtree/org.id', 'OrgId');
const LifDeposit = Contracts.getFromNodeModules('@windingtree/trust-clue-lif-deposit', 'LifDeposit');
const LifToken = Contracts.getFromNodeModules('@windingtree/lif-token', 'LifToken');

module.exports = function (config, cached) {

    let orgidContract = false;
    let lifDepositContract = false;
    let lifTokenContract = false;
    const orgid0x = '0x0000000000000000000000000000000000000000000000000000000000000000';

    const getOrgidFromDns = async (link) => {
        return new Promise((resolve) => {
            try {
                if(link.indexOf('://') === -1) link = `https://${link}`;
                const myURL = new URL(link);
                dns.resolveTxt(myURL.hostname, (err, data) => {
                    if (err) return resolve(undefined);
                    let orgid = _.get(_.filter(data, (record) => record && record.length && record[0].indexOf('orgid=') === 0), '[0][0]', false);
                    if (orgid) orgid = orgid.replace('orgid=', '').replace('did:orgid:');
                    return resolve(orgid);
                })
            } catch (e) {
                resolve(false)
            }

        })
    };

    const getOrgidFromUrl = async (link) => {
        return new Promise(async (resolve) => {
            try {
                const fetched = await fetch(`${link}/org.id`);
                let body = await fetched.text();
                body = body.replace('orgid=', '').replace('did:orgid:');
                resolve(body);
            } catch (e) {
                resolve(false);
            }
        })
    };

    const getOrgidFromLink = async (link) => {
        let orgid = await getOrgidFromDns(link);
        if (!orgid) orgid = await getOrgidFromUrl(link);
        return orgid;
    };

    const checkSslByUrl = (link, expectedLegalName) => {
        return new Promise(async (resolve) => {
            if(link.indexOf('://') === -1) link = `https://${link}`;
            const dns = await getOrgidFromDns(link);
            if (dns === undefined) return resolve(dns);
            let requestSsl;
            try {
                let { hostname } = new URL(link);
                let isAuthorized = false;
                const options = { host: hostname, method: 'get', path: '/', agent: new https.Agent({ maxCachedSessions: 0 }) };
                let companySiteHostnameFromServer, legalNameFromServer;
                requestSsl = https.request(options, (response) => {
                    let subject = response.socket.getPeerCertificate().subject;
                    let CN = subject.CN.replace('*.','');
                    if(CN.indexOf('://') === -1) CN = `https://${CN}`;
                    companySiteHostnameFromServer = new URL(CN).hostname;
                    legalNameFromServer = subject.O;
                    console.log(companySiteHostnameFromServer, legalNameFromServer);

                    isAuthorized = response.socket.authorized;
                    resolve(isAuthorized && (legalNameFromServer === expectedLegalName) && (companySiteHostnameFromServer === hostname))
                });
                requestSsl.end();
            } catch (e) {
                console.log('checkSslByUrl [ERROR]', e.toString());
                resolve(false)
            }
        })

    };


    const getEnvironment = () => {
        const { currentEnvironment, environments } = config();
        const provider = new Web3.providers.WebsocketProvider(`wss://ropsten.infura.io/ws/v3/${environments[currentEnvironment].infuraId}`);
        const web3 = new Web3(provider);

        return Object.assign({}, environments[currentEnvironment], { provider, web3 });
    };

    const getCurrentBlockNumber = async () => {
        const { web3 } = getEnvironment();
        return new Promise((resolve, reject) => {
            web3.eth.getBlockNumber((err, data) => {
                if(err) return reject(err);
                resolve(data);
            });
        });
    };

    const getOrgidContract = async () => {
        if (orgidContract) return orgidContract;
        const { web3, orgidAddress } = getEnvironment();
        orgidContract = await OrgId.at(orgidAddress);
        orgidContract.setProvider(web3.currentProvider);
        return orgidContract
    };

    const getLifDepositContract = async () => {
        if (lifDepositContract) return lifDepositContract;
        const environment = getEnvironment();
        lifDepositContract = LifDeposit.at(environment.lifDepositAddress);
        lifDepositContract.setProvider(environment.web3.currentProvider);
        return lifDepositContract;
    };

    const getLifTokenContract = async () => {
        if (lifTokenContract) return lifTokenContract;
        const environment = getEnvironment();
        lifTokenContract = LifToken.at(environment.lifTokenAddress);
        lifTokenContract.setProvider(environment.web3.currentProvider);
        return lifTokenContract;
    };

    const getOrganizationsList = async () => {
        const orgidContract = await getOrgidContract();
        return orgidContract.methods.getOrganizations().call();
    };

    const getOrganization = async (orgid) => {
        const orgidContract = await getOrgidContract();
        try {
            return orgidContract.methods.getOrganization(orgid).call();
        } catch (e) {
            log.error(`Error during getting getOrganization ${orgid} from smartcontract`);
            throw e;
        }

    };

    const getSubsidiaries = async (orgid) => {
        const orgidContract = await getOrgidContract();
        return orgidContract.methods.getSubsidiaries(orgid).call();
    };

    const parseOrganization = async (orgid, parentOrganization = false) => {
        log.debug('[.]', chalk.blue('parseOrganization'), orgid, typeof orgid);
        const { currentEnvironment, environments } = config();
        const { lifDecimals, lifMinimumDeposit } = environments[currentEnvironment];
        const { /*orgId,*/ orgJsonUri, orgJsonHash, parentEntity, owner, director, state, directorConfirmed, deposit } = await getOrganization(orgid);
        const orgIdLifDepositAmount = parseFloat(`${deposit.substr(0, deposit.length - lifDecimals)}.${deposit.substr(deposit.length - lifDecimals)}`);
        console.log('const subsidiaries = (parentEntity !== orgid0x) ? [] : await getSubsidiaries(orgid);');
        const subsidiaries = (parentEntity !== orgid0x) ? [] : await getSubsidiaries(orgid);
        if (parentEntity !== orgid0x && parentOrganization === false) {
            parentOrganization = parseOrganization(parentEntity);
        }
        // off-chain
        let jsonContent, orgJsonHashCalculated, isJsonValid, autoCache;
        process.stdout.write('off-chain... ');
        try {
            const orgJsonResponse = await fetch(orgJsonUri);
            process.stdout.write('[READ-OK]\n');
            const orgJsonText = await orgJsonResponse.text();
            orgJsonHashCalculated = Web3.utils.keccak256(orgJsonText);
            jsonContent = JSON.parse(orgJsonText);
            autoCache = Web3.utils.keccak256(JSON.stringify(jsonContent, null, 2));
            isJsonValid = (orgJsonHashCalculated === orgJsonHash) || (autoCache === orgJsonHash);
        } catch (e) {
            process.stdout.write('[ERROR]\n');
            log.debug(e.toString());
        }

        if (!jsonContent) throw 'Cannot get jsonContent';
        if (!isJsonValid) throw `(got hash=${chalk.red(orgJsonHashCalculated === autoCache ? autoCache : `${orgJsonHashCalculated} ~ ${autoCache}`)} BUT expected ${chalk.green(orgJsonHash)}) for uri ${orgJsonUri}`;
        const orgidType = (typeof jsonContent.legalEntity === 'object') ? 'legalEntity' : (typeof jsonContent.organizationalUnit === 'object' ? 'organizationalUnit' : 'unknown');
        const directory = orgidType === 'legalEntity' ? 'legalEntity' : _.get(jsonContent, 'organizationalUnit.type', 'unknown');
        const name = _.get(jsonContent,  orgidType === 'legalEntity' ? 'legalEntity.legalName' : 'organizationalUnit.name', 'Name is not defined');
        const logo = _.get(jsonContent,  'media.logo', undefined);
        const parent = (parentEntity !== orgid0x) ? { orgid: parentEntity, name: parentOrganization.name, proofsQty: parentOrganization.proofsQty || 0 } : undefined;
        const country = _.get(jsonContent, orgidType === 'legalEntity' ? 'legalEntity.registeredAddress.country' : 'organizationalUnit.address.country', '');
        const contacts = _.get(jsonContent, `${orgidType}.contacts[0]`, {});
        const website = contacts.website;
        const isWebsiteProved = (orgid === (await getOrgidFromLink(website)));
        // console.log('website', website, 'orgid', orgid , 'from site', (await getOrgidFromLink(website)));
        let isSslProved = false;
        if (isWebsiteProved) isSslProved = checkSslByUrl(website);
        /*
        process.stdout.write('lif-deposit... ');
        let lifDepositValue;
        try {
            const lifDepositContract = await getLifDepositContract();
            lifDepositValue = await lifDepositContract.methods.getDepositValue(orgid).call();
            process.stdout.write('[READ-OK]\n');
            log.debug('lifDepositValue', lifDepositValue);
        } catch (e) {
            process.stdout.write('[ERROR]\n');
            log.debug(e.toString());
        }
        */
        let isLifProved =  orgIdLifDepositAmount >= lifMinimumDeposit,
            isSocialFBProved = false,
            isSocialTWProved = false,
            isSocialIGProved = false,
            isSocialLNProved = false;
        const isSocialProved = isSocialFBProved || isSocialTWProved || isSocialIGProved || isSocialLNProved;
        return {
            orgid,
            owner,
            subsidiaries,
            parent,
            orgidType,
            directory,
            director,
            state,
            directorConfirmed,
            name,
            logo,
            country,
            proofsQty: _.compact([isWebsiteProved, isSslProved, isLifProved, isSocialProved]).length,
            isLifProved,
            isWebsiteProved,
            isSslProved,
            // isSocialFBProved
            // isSocialTWProved
            // isSocialIGProved
            // isSocialLNProved
            isJsonValid,
            orgJsonHash,
            orgJsonUri,
            jsonContent,
            jsonCheckedAt: new Date().toJSON(),
            jsonUpdatedAt: new Date().toJSON()
        };
    };

    const scrapeOrganizations = async () => {
        const organizations = await getOrganizationsList();
        log.info('Scrape organizations:', organizations);

        for(let orgid of organizations) {

            let organization = {};
            try {
                organization = await parseOrganization(orgid);
                await cached.upsertOrgid(organization);
            } catch (e) {
                log.warn('Error during parseOrganization / upsertOrgid', e.toString());
            }

            if (organization.subsidiaries) {
                log.info('PARSE SUBSIDIARIES:', JSON.stringify(organization.subsidiaries));
                for(let orgid of organization.subsidiaries) {
                    try {
                        let subOrganization = await parseOrganization(orgid, organization);
                        await cached.upsertOrgid(subOrganization);
                    } catch (e) {
                        log.warn('Error during [SubOrg] parseOrganization / upsertOrgid', e.toString());
                    }
                }
            }
        }
    };

    const resolveOrgidEvent = async (event) => {
        log.debug("=================== :EVENT: ===================");
        try {
            log.debug(event.event ? event.event : event.raw, event.returnValues);
            let organization, subOrganization;
            switch (event.event) {
                case "OrganizationCreated":
                case "OrganizationOwnershipTransferred":
                case "OrgJsonUriChanged":
                case "OrgJsonHashChanged":
                    organization = await parseOrganization(event.returnValues.orgId);
                    await cached.upsertOrgid(organization);
                    break;
                case "SubsidiaryCreated":
                    organization = await parseOrganization(event.returnValues.parentOrgId);
                    await cached.upsertOrgid(organization);
                    subOrganization = await parseOrganization(event.returnValues.subOrgId, organization);
                    await cached.upsertOrgid(subOrganization);
                    break;
                case "LifDepositAdded":
                case "WithdrawalRequested":
                case "DepositWithdrawn":
                    break;
                case "WithdrawDelayChanged":
                    break;
                default :
                    log.debug(`this event do not have any reaction behavior`);
            }
        } catch (e) {
            log.error('Error during resolve event', e.toString())
        }

    };

    const listenEvents = async () => {
        try {
            const orgidContract = await getOrgidContract();
            const currentBlockNumber = await getCurrentBlockNumber();
            log.debug(`event listening started...${chalk.grey(`(from block ${currentBlockNumber})`)}`);
            orgidContract.events
                .allEvents({ fromBlock: currentBlockNumber - 10 /* -10 in case of service restart*/ }, async (/*error, event*/) => {})
                .on('data', resolveOrgidEvent)
                .on('changed', (event) => log.debug("=================== Changed ===================\r\n", event))
                .on('error', (error) => log.debug("=================== ERROR ===================\r\n", error));
        } catch (e) {
            log.error('Error during listenEvents', e.toString());
        }
    };

    return Promise.resolve({
        scrapeOrganizations,
        listenEvents,

        visibleForTests: {
            getEnvironment,
            getOrgidContract,
            getLifDepositContract,
            getLifTokenContract,
            getOrganizationsList,
            getOrganization,
            getSubsidiaries,
            parseOrganization,
        }
    });
};
