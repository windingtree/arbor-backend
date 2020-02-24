const _ = require('lodash');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';
const fetch = require('node-fetch');
const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const OrgId = Contracts.getFromNodeModules('@windingtree/org.id', 'OrgId');

const OrganizationFactory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'OrganizationFactory');
const Organization = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'Organization');
const LifDeposit = Contracts.getFromNodeModules('@windingtree/trust-clue-lif-deposit', 'LifDeposit');
const Entrypoint = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'WindingTreeEntrypoint');
const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');

module.exports = function (config, cached) {

    let orgidContract = false;
    let lifDepositContract = false;
    const orgid0x = '0x0000000000000000000000000000000000000000000000000000000000000000';

    const getEnvironment = () => {
        const { currentEnvironment, environments } = config();
        const provider = new Web3.providers.HttpProvider(environments[currentEnvironment].provider);
        const web3 = new Web3(provider);

        return Object.assign({}, environments[currentEnvironment], { provider, web3 });
    };

    const getOrgidContract = async () => {
        if (orgidContract) return orgidContract;
        const environment = getEnvironment();
        orgidContract = await OrgId.at(environment.orgidAddress);
        orgidContract.setProvider(environment.web3.currentProvider);

        return orgidContract
    };

    const getLifDepositContract = async () => {
        if (lifDepositContract) return lifDepositContract;
        const environment = getEnvironment();
        lifDepositContract = LifDeposit.at(environment.lifDepositAddress);
        lifDepositContract.setProvider(environment.web3.currentProvider);
        return lifDepositContract;
    };

    const getOrganizationsList = async () => {
        const orgidContract = await getOrgidContract();
        return orgidContract.methods.getOrganizations().call();
    };

    const getOrganization = async (orgid) => {
        const orgidContract = await getOrgidContract();
        return orgidContract.methods.getOrganization(orgid).call();
    };

    const getSubsidiaries = async (orgid) => {
        const orgidContract = await getOrgidContract();
        return orgidContract.methods.getSubsidiaries(orgid).call();
    };

    const parseOrganization = async (orgid) => {
        const { /*orgId,*/ orgJsonUri, orgJsonHash, parentEntity, owner, director, state, directorConfirmed } = await getOrganization(orgid);
        const subsidiaries = (parentEntity === orgid0x) ? [] : await getSubsidiaries(orgid);
        if (parentEntity !== orgid0x) {
            // ... update parent trust recursive
        }
        // off-chain
        let jsonContent, orgJsonHashCalculated;
        process.stdout.write('off-chain... ');
        try {
            const orgJsonResponse = await fetch(orgJsonUri);
            process.stdout.write('[READ-OK]\n');
            const orgJsonText = await orgJsonResponse.text();
            orgJsonHashCalculated = Web3.utils.keccak256(orgJsonText);
            jsonContent = JSON.parse(orgJsonText);
        } catch (e) {
            process.stdout.write('[ERROR]\n');
            log.debug(e);
        }

        const orgidType = (typeof jsonContent.legalEntity === 'object') ? 'legalEntity' : (typeof jsonContent.organizationalUnit === 'object' ? 'organizationalUnit' : 'unknown');
        const directory = orgidType === 'legalEntity' ? 'legalEntity' : _.get(jsonContent, 'organizationalUnit.type', 'unknown');
        const name = _.get(jsonContent,  orgidType === 'legalEntity' ? 'legalEntity.legalName' : 'organizationalUnit.name', 'Name is not defined');
        const logo = _.get(jsonContent,  'media.logo', undefined);
        const parent = (parentEntity !== orgid0x) ? { orgid: parentEntity,/* name, proofsQty, */ } : undefined;
        const country = _.get(jsonContent, orgidType === 'legalEntity' ? 'legalEntity.registeredAddress.country' : 'organizationalUnit.address', '');

        process.stdout.write('lif-deposit... ');
        let lifDepositValue;
        try {
            const lifDepositContract = await getLifDepositContract();
            lifDepositValue = await lifDepositContract.methods.getDepositValue(orgid).call();
            process.stdout.write('[READ-OK]\n');
            console.log('lifDepositValue', lifDepositValue);
        } catch (e) {
            process.stdout.write('[ERROR]\n');
            log.debug(e.toString());
        }

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
            // proofsQty
            isLifProved: !!lifDepositValue,
            // isWebsiteProved
            // isSslProved
            // isSocialFBProved
            // isSocialTWProved
            // isSocialIGProved
            // isSocialLNProved
            isJsonValid: orgJsonHashCalculated === orgJsonHash,
            orgJsonHash,
            orgJsonUri,
            jsonContent,
            jsonCheckedAt: new Date().toJSON(),
            jsonUpdatedAt: new Date().toJSON()
        };
    };

    const scrapeOrganizations = async () => {
        const organizations = await getOrganizationsList();
        console.log(organizations);
        for(let orgid of organizations) {
            const organization = await parseOrganization(orgid);
            await cached.upsertOrgid(organization);
        }
    };

    const scrapeOrganization = async (orgAddress, segments, envName, providerAddress, lifDepositAddress) => {
        const res = {
            environment: envName,
            segments: segments,
            address: orgAddress,
            orgid: orgAddress,
        };

        // on-chain
        process.stdout.write('on-chain... ');
        const provider = new Web3.providers.HttpProvider(providerAddress);
        const web3 = new Web3(provider);
        const organization = await Organization.at(orgAddress);
        organization.setProvider(web3.currentProvider);
        try {
            res.orgid = await organization.address; //TODO review
            res.owner = await organization.methods.owner().call();
            res.orgJsonUri = await organization.methods.orgJsonUri().call();
            log.debug(res.orgJsonUri);
            res.orgJsonHash = await organization.methods.orgJsonHash().call();
            const createdBlock = await organization.methods.created().call();
            const resolvedBlock = await web3.eth.getBlock(createdBlock);
            res.lastBlockUpdated = parseInt(createdBlock);
            res.dateCreated = resolvedBlock ? new Date(resolvedBlock.timestamp * 1000) : new Date();
            const associatedKeys = await organization.methods.getAssociatedKeys().call();
            associatedKeys.shift(); // remove zeroeth item
            res.associatedKeys = associatedKeys;//.join(',');

            // off-chain
            process.stdout.write('off-chain... ');
            let orgJsonResponse, orgJsonText;
            try {
                orgJsonResponse = await fetch(res.orgJsonUri);
                orgJsonText = await orgJsonResponse.text();
            } catch (e) {
                log.debug(e);

            }
            let orgJsonContent;
            try {
                orgJsonContent = JSON.parse(orgJsonText);
                res.orgJsonContent = orgJsonText;
            } catch (e) {
                console.warn(`Invalid json for org.id at ${orgAddress}`);
            }

            if (orgJsonContent) {
                if (orgJsonContent.updatedAt) {
                    res.dateUpdated = new Date(orgJsonContent.updatedAt);
                }

                if (orgJsonContent.legalEntity) {
                    res.name = orgJsonContent.legalEntity.name;
                    if (orgJsonContent.legalEntity.address) {
                        res.city = orgJsonContent.legalEntity.address.city;

                        const postal = orgJsonContent.legalEntity.address;
                        const postalAddressString = `${postal.houseNumber || ''} ${postal.road || ''}, ${postal.city || ''}, ${postal.postcode || ''}, ${postal.countryCode || ''}`;
                        console.log(postalAddressString)
                        /*const { gpsCoordsLat, gpsCoordsLon } = await findCoordinates(postalAddressString);
                        res.gpsCoordsLat = gpsCoordsLat;
                        res.gpsCoordsLon = gpsCoordsLon;*/
                    }
                }
            }

            // deposit
            process.stdout.write('lif-deposit... ');
            const deposit = LifDeposit.at(lifDepositAddress);
            deposit.setProvider(web3.currentProvider);
            res.lifDepositValue = await deposit.methods.getDepositValue(orgAddress).call();

            res.timestamp = new Date();

            process.stdout.write('res parsed');
        }
        catch (e) {
            log.debug(e);
        }
        log.info(JSON.stringify(res, null, 2));

        await cached.upsertOrgid(res);


        //await Snapshot.upsert(res);

        log.debug('done.');

        return res;
    };

    const prepareToScrapeDirectory = async function (orgSegmentsIndex, segmentName, directoryAddress, providerAddress) {
        const provider = new Web3.providers.HttpProvider(providerAddress);
        const web3 = new Web3(provider);

        const directory = SegmentDirectory.at(directoryAddress);
        directory.setProvider(web3.currentProvider);

        const segment = await directory.methods.getSegment().call();
        console.log(`Preparing segment ${segment}`);
        const organizations = await directory.methods.getOrganizations().call();

        for (const orgAddress of organizations) {
            if (orgAddress !== '0x0000000000000000000000000000000000000000') {
                if (orgSegmentsIndex[orgAddress]) {
                    orgSegmentsIndex[orgAddress] = `${orgSegmentsIndex[orgAddress]},${segment}`;
                } else {
                    orgSegmentsIndex[orgAddress] = segment;
                }
            }
        }
    };

    const scrapeEnvironment = async (envName, environment) => {

        console.log(`Scraping environment ${envName}`);
        const provider = new Web3.providers.HttpProvider(environment.provider);
        const web3 = new Web3(provider);

        const entrypoint = await Entrypoint.at(environment.entrypoint);
        entrypoint.setProvider(web3.currentProvider);

        const segmentCount = await entrypoint.methods.getSegmentsLength().call();
        const orgSegmentsIndex = {};
        for (let i = 1; i < segmentCount; i++) {
            const segmentName = await entrypoint.methods.getSegmentName(i).call();
            const segmentAddress = await entrypoint.methods.getSegment(segmentName).call();
            if (segmentAddress !== '0x0000000000000000000000000000000000000000') {
                await prepareToScrapeDirectory(orgSegmentsIndex, segmentName, segmentAddress, environment.provider);
            }
        }
        for (const orgAddress in orgSegmentsIndex) {
            try {
                await scrapeOrganization(orgAddress, orgSegmentsIndex[orgAddress], envName, environment.provider, environment.lifDeposit);
            } catch (e) {
                console.error(e);
            }
        }
    };

    const refreshProvider = (web3Obj, providerUrl) => {
        let retries = 0;

        function retry(event) {
            if (event) {
                log.debug('Web3 provider disconnected or errored.');
                retries += 1;

                if (retries > 5) { //TODO: check if retry working
                    log.debug(`Max retries of 5 exceeding: ${retries} times tried`);
                    return setTimeout(refreshProvider, 5000)
                }
            } else {
                refreshProvider(web3Obj, providerUrl)
            }

            return null
        }

        const provider = new Web3.providers.WebsocketProvider(providerUrl);

        provider.on('end', () => {
                log.debug("Connection ended");
                retry()
            }
        );
        provider.on('error', () => retry());

        web3Obj.setProvider(provider);

        log.debug('New Web3 provider initiated');

        return provider
    };

    const setEntrypoint = async (envName, web3obj) => {
        if (!config().environments[envName]) {
            throw 'Unknown environment';
        }
        const environment = config().environments[envName];


        let wssProvider = refreshProvider(web3obj, `wss://ropsten.infura.io/ws/v3/${environment.infuraId}`);
        const entrypoint = await Entrypoint.at(environment.entrypoint);
        entrypoint.setProvider(wssProvider);
        return entrypoint
    };

    const listenEnvironmentEvents = async (envName) => {
        const web3 = await new Web3();
        const environment = config().environments[envName];
        const entrypoint = await setEntrypoint(envName, web3);
        let factory = await entrypoint.methods.getOrganizationFactory();
        let factoryCalled = await factory.call();
        const abi = OrganizationFactory.schema.abi;
        let contract = await new web3.eth.Contract(abi, factoryCalled);
        const currentBlock = await web3.eth.getBlockNumber();
        log.debug(`currentBlock: ${currentBlock}`);
        createListenersForAllOrganizations(envName);
        log.debug('=========================== Listen to all events ==============================');
        contract.events
            .allEvents(
                {
                    fromBlock: currentBlock
                },
                async (/*error, event*/) => {
                    /*
                    if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                        log.debug("Loaded OrgCreated event")
                    }*/
                    //log.debug(event);
                }
            )
            .on('data', async (event) => {
                log.debug("=================== Data ==========");
                if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                    let createdAddress = `0x${event.raw.topics[1].slice(-40)}`;
                    log.debug(`OrganizationCreated:${createdAddress}`);
                    const organization = await scrapeOrganization(createdAddress, 'test_segment', envName, environment.provider, environment.lifDeposit);
                    listenOrganizationChangeEvents(envName, organization.orgid);
                } else {
                    log.debug("Not an OrganizationCreated event")
                }

                //log.debug(event);
            })
            .on('changed', (event) => {
                log.debug("=================== Changed ===================");
                log.debug(event);
            })
            .on('error', (error) => {
                log.debug(error);
            });


    };
    const createListenersForAllOrganizations = async (envName) => {
        const organizations = await cached.getOrgIds();
        log.debug(typeof organizations);
        let allEvents = {};
        for (let i = 0; i < organizations.length; i++) {
            log.debug(`==============${organizations[i].orgid}=============`);
            allEvents[organizations[i].orgid] = await listenOrganizationChangeEvents(envName, organizations[i].orgid);
        }
        log.debug(allEvents);
    };


    const listenOrganizationChangeEvents = async (envName, orgId) => {
        log.debug(`============== Creating listener for ${orgId} ============`);
        const web3 = await new Web3();
        const abi = Organization.schema.abi;
        let contract = await new web3.eth.Contract(abi, orgId);
        const currentBlock = (await cached.getOrgId(orgId)).lastBlockUpdated;
        log.debug(`currentBlockForOrg: ${currentBlock}`);
        try {
            contract.events
                .allEvents(
                    {
                        fromBlock: 0//currentBlock
                    },
                    async (/*error, event*/) => {
                        /*
                        if (event.raw.topics[0] === "0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea") {
                            log.debug("Loaded OrgCreated event")
                        }*/
                        //log.debug(event);
                    }
                )
                .on('data', async (event) => {
                    log.debug("=================== Data ===================");
                    //const events = config().savedSha3;

                    switch (event.event) {
                        case "OwnershipTransferred":
                            const newOwner = event.returnValues.newOwner;
                            cached.upsertOrgid({orgid: orgId, owner: newOwner});
                            log.debug('OwnershipTransferred');
                            break;
                        case "OrgJsonUriChanged":
                            const newOrgJsonUri = event.returnValues.newOrgJsonUri;
                            cached.upsertOrgid({orgid: orgId, orgJsonUri: newOrgJsonUri});
                            log.debug('OrgJsonUriChanged');
                            break;
                        case "OrgJsonHashChanged":
                            const newOrgJsonHash = event.returnValues.newOrgJsonHash;
                            cached.upsertOrgid({orgid: orgId, orgJsonHash: newOrgJsonHash});
                            log.debug('OrgJsonHashChanged');
                            break;
                        case "AssociatedKeyAdded":
                            const associatedKey = event.returnValues.associatedKey;
                            let orgid = await cached.getOrgIdRaw(orgId);
                            const keys = orgid.associatedKeys ? [associatedKey, ...orgid.associatedKeys] : [associatedKey];
                            await orgid.update({associatedKeys: _.uniq(keys)});
                            log.debug('AssociatedKeyAdded');
                            break;
                        case "AssociatedKeyRemoved":
                            const associatedKeyRemoved = event.returnValues.associatedKey;
                            log.debug('AssociatedKeyRemoved', associatedKeyRemoved);
                            break;
                        /*case "OrganizationCreated":
                            let createdAddress = `0x${event.raw.topics[1].slice(-40)}`;
                            log.debug(`OrganizationCreated:${createdAddress}`);
                            const organization = await scrapeOrganization(createdAddress, 'test_segment', envName, environment.provider, environment.lifDeposit);
                            break;*/
                        default :
                            log.debug(`Not a supported event: ${event.event}`);
                    }
                })
                .on('changed', (event) => {
                    log.debug("=================== Changed ===================");
                    log.debug(event);
                })
                .on('error', (error) => {
                    log.debug(error);
                });
        } catch (e) {
            log.debug(e.message);
        }

    };

    return Promise.resolve({
        scrapeOrganizations,

        scrapeEnvironment,
        scrapeOrganization,
        listenEnvironmentEvents,
        createListenersForAllOrganizations,
        setEntrypoint,
        listenOrganizationChangeEvents,
        refreshProvider,
        visibleForTests: {
            getEnvironment,
            getOrgidContract,
            getLifDepositContract,
            getOrganizationsList,
            getOrganization,
            getSubsidiaries,
            parseOrganization,


            scrapeOrganization,
            prepareToScrapeDirectory
        }
    });
};
