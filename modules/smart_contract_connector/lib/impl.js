const Web3 = require('web3');
const _ = require('lodash');
const chalk = require('chalk');
const {
    waitForBlockNumber,
    createResolver,
    getTrustAssertsion,
    getCurrentBlockNumber,
    checkSslByUrl,
    SimpleQueue,
    fetchDirectoriesIndex,
    subscribeDirectoriesEvents,
    unsubscribeDirectoriesEvents
} = require('./utils');

// Web3 Connection Guard
const connectionGuard = require('./guard');

const log = require('log4js').getLogger('smart_contracts_connector');
log.level = 'debug';

// Constants
const orgid0x = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = (config, cached) => {
    const { currentEnvironment, environments } = config();
    const environment = environments[process.env.NODE_ENV === 'dev' ? 'development' : currentEnvironment];

    let web3;
    let orgIdResolver;
    let orgidContract;
    let eventsSubscription;
    let isConnected = false;
    let isReconnection = false;
    let dirsSubscriptions = [];

    // Start connection for events listener with guard
    connectionGuard(
        `wss://${environment.network}.infura.io/ws/v3/${environment.infuraId}`,
        // Diconnection handler
        () => {
            isConnected = false;
            isReconnection = true;
            unsubscribeDirectoriesEvents(dirsSubscriptions);
        },
        // Connection handler
        async _web3 => {
            try {
                web3 = _web3;
                orgIdResolver = createResolver(
                    web3,
                    environment.orgidAddress
                );
                orgidContract = (await orgIdResolver.getOrgIdContract());
                eventsSubscription = await listenEvents(web3, orgidContract, orgIdResolver);
                dirsSubscriptions = await startDirsSubscriptions(web3, environment.directoryIndexAddress);
                isConnected = true;
                isReconnection = false;
            } catch (error) {
                isConnected = false;
                log.error('Before subscribe:', error)
            }
        }
    );

    // Queue for promises
    const queue = new SimpleQueue();

    const startDirsSubscriptions = async (web3, directoryIndexAddress) => {
        return;// @todo REMOVE after new directories feature will be enabled
        try {
            const directories = await fetchDirectoriesIndex(web3, directoryIndexAddress);
            return subscribeDirectoriesEvents(web3, 'latest', directories, event => {
                switch (event.event) {
                    case 'OrganizationChallenged':
                    case 'Dispute':
                        // Send email to organization owner
                        break;
                    default:
                        // Ignore all other events
                }
            });
        } catch (error) {
            log.error('Error during startDirsSubscriptions', error.toString());
        }
    };

    // Start Listening on all OrgId contract Events
    const listenEvents = async (web3, orgidContract, orgIdResolver) => {

        try {
            const lastKnownBlockNumber = await cached.getBlockNumber();
            log.debug(`Subscribing to events of Orgid ${chalk.grey(`at address: ${orgidContract.options.address}`)}`);

            const listenBlock = lastKnownBlockNumber - 10;
            const subscription = orgidContract.events
                .allEvents({
                    fromBlock: listenBlock >= 0 ? listenBlock : 0
                })

                // Connection established
                .on('connected', subscriptionId => {
                    log.debug(`Subscription Id: ${subscriptionId}`);
                })

                // Event Received
                .on(
                    'data',
                    event => queue.add(
                        resolveOrgidEvent,
                        [
                            web3,
                            orgidContract,
                            orgIdResolver,
                            event
                        ]
                    )
                )

                // Change event
                .on('changed', event => log.debug("=================== Changed ===================\r\n", event))

                // Error Event
                .on('error', error => log.debug("=================== ERROR ===================\r\n", error));

            log.debug(`Events listening started ${chalk.grey(`from block ${lastKnownBlockNumber}`)}`);

            return subscription;
        } catch (error) {
            log.error('Error during listenEvents', error.toString());
        }
    };

    // Process the event
    const resolveOrgidEvent = async (web3, orgidContract, orgIdResolver, event) => {
        log.debug(`=================== :EVENT: ${event.event} : ===================`);

        try {
            const currentBlockNumber = await getCurrentBlockNumber(web3);

            log.debug(event.event ? event.event : event.raw, event.returnValues);

            await waitForBlockNumber(web3, event.blockNumber);

            let organization;
            let subOrganization;

            switch (event.event) {
                case "OrganizationCreated":
                case "OrganizationActiveStateChanged":
                case "OrganizationOwnershipTransferred":
                case "OrgJsonChanged":

                    organization = await parseOrganization(
                        web3,
                        orgidContract,
                        event.returnValues.orgId,
                        orgIdResolver
                    );
                    await cached.upsertOrgid(organization);

                    log.info('Parsed organization:', JSON.stringify(organization));
                    break;

                // Event fired when a Unit is created/changed
                case "UnitCreated":
                    parentOrganization = await parseOrganization(
                        web3,
                        orgidContract,
                        event.returnValues.parentOrgId,
                        orgIdResolver
                    );
                    subOrganization = await parseOrganization(
                        web3,
                        orgidContract,
                        event.returnValues.unitOrgId,
                        orgIdResolver
                    );
                    await cached.upsertOrgid(parentOrganization);
                    await cached.upsertOrgid(subOrganization);

                    log.info(JSON.stringify(parentOrganization));
                    log.info(JSON.stringify(subOrganization));
                    break;

                default:
                    log.debug(`this event do not have any reaction behavior`);
            }

            // Saving a block number where the event has been successfully parsed
            await cached.saveBlockNumber(String(currentBlockNumber));
        } catch (error) {
            log.error('Error during resolve event', error);

            if (error.message.match(/^Unable to resolve a DID document/)) {
                cached.updateOrgidData(event.returnValues.orgId, {
                    isJsonValid: false
                })
                .catch(e => log.error('Error during organization update', e));
            }
        }
    };

    // Get the Units of an orgid
    const getUnits = (orgidContract, orgid) => {
        return orgidContract.methods
            .getUnits(orgid, true)
            .call();
    };

    const toChecksObject = checks => checks.reduce(
        (a, { type, passed, errors = [], warnings = [] }) => {
            a = {
                ...a,
                [type]: {
                    passed,
                    errors,
                    warnings
                }
            };
            return a;
        },
        {}
    );

    // Parse an organization
    const parseOrganization = async (web3, orgidContract, orgid, orgIdResolver) => {
        log.debug('[.]', chalk.blue('parseOrganization'), orgid, typeof orgid);

        const resolverResult = await orgIdResolver.resolve(`did:orgid:${orgid}`);

        let jsonContent;

        if (resolverResult.didDocument && resolverResult.organization) {
            jsonContent = resolverResult.didDocument;
        } else {
            throw new Error(
                `Unable to resolve a DID document for the orgId: ${orgid}`
            );
        }

        log.debug(`Organization Details: ${JSON.stringify(resolverResult.organization)}`);
        log.debug(`Organization DID document: ${JSON.stringify(resolverResult.didDocument)}`);

        const checks = toChecksObject(resolverResult.checks);

        isJsonValid = checks.DID_DOCUMENT.passed

        const {
            orgJsonHash,
            orgJsonUri,
            parentOrgId,
            owner,
            director,
            isActive,
            isDirectorshipAccepted
        } = resolverResult.organization;

        // Retrieve the parent organization (if exists)
        let parent;

        if (parentOrgId !== orgid0x) {
            try {
                parent = await parseOrganization(
                    web3,
                    orgidContract,
                    parentOrgId,
                    orgIdResolver
                );
            } catch (error) {
                log.error('Unable to resolve parent organization', error);
            }
        }

        // Retrieve OrgID Type
        let orgidType = 'unknown';

        if (jsonContent.legalEntity) {
            orgidType = 'legalEntity';
        } else if (jsonContent.organizationalUnit) {
            orgidType = 'organizationalUnit';
        }

        // Retrieve Directory
        let directory = 'unknown';

        if (orgidType === 'legalEntity') {
            directory = 'legalEntity';
        } else if (orgidType === 'organizationalUnit') {
            directory = jsonContent.organizationalUnit.type;
            // Directory should be an array
            // But Database expects a string
            if (Array.isArray(directory)) {
                // Backward compatibility for Arbor BE
                if (directory.length === 1) {
                    directory = directory[0];
                } else {
                    directory = JSON.stringify(directory);
                }
            }
        }

        // Retrieve name
        let name = 'Name is not defined';

        if (orgidType == 'legalEntity') {
            name = jsonContent.legalEntity.legalName;
        } else if (orgidType == 'organizationalUnit') {
            name = jsonContent.organizationalUnit.name;
        }

        // Retrieve country
        let country;

        if (orgidType == 'legalEntity' && jsonContent.legalEntity.registeredAddress) {
            country = jsonContent.legalEntity.registeredAddress.country;

        } else if (orgidType == 'organizationalUnit' && jsonContent.organizationalUnit.address) {
            country = jsonContent.organizationalUnit.address.country;
        }

        if (country && country.length !== 2) {
            country = '';
        }

        // Retrieve logo
        let logo;

        if (jsonContent.media) {
            logo = jsonContent.media.logo;
        }

        // Facebook Trust clue
        const isSocialFBProved = getTrustAssertsion(resolverResult, 'social', 'facebook');

        // Twitter Trust clue
        const isSocialTWProved = getTrustAssertsion(resolverResult, 'social', 'twitter');

        // Instagram Trust clue
        const isSocialIGProved = getTrustAssertsion(resolverResult, 'social', 'instagram');
        console.log(JSON.stringify({ resolverResult, isSocialIGProved }, null, 2))

        // Linkedin Trust clue
        const isSocialLNProved = getTrustAssertsion(resolverResult, 'social', 'linkedin');

        // Web-site Trust clue
        let website;
        let isWebsiteProved = false
        let isSslProved = false;

        try {
            website = resolverResult.trust && resolverResult.trust.assertions
                ? resolverResult.trust.assertions.reduce(
                    (a, v) => {
                        if (v.type === 'domain') {
                            a = new URL(v.proof).hostname;
                        }
                        return a;
                    },
                    ''
                )
                : null;

                isWebsiteProved = getTrustAssertsion(resolverResult, 'domain', '') ||
                    getTrustAssertsion(resolverResult, 'dns', '');

            // SSL Trust clue
            isSslProved = website
                ? await checkSslByUrl(website, name)
                : false;
        } catch (error) {
            log.error(error);
        }

        // Overall Social Trust proof
        const isSocialProved = isSocialFBProved || isSocialTWProved || isSocialIGProved || isSocialLNProved;

        // Counting total count of proofs
        const proofsQty = _.compact([isWebsiteProved, isSslProved, isSocialProved]).length;

        // Retrieve the subsidiaries (if exists)
        let subsidiaries = await getUnits(orgidContract, orgid);

        // Retrurn all the organization details
        return {
            orgid,
            owner,
            subsidiaries,
            parent,
            orgidType,
            directory,
            director,
            state: isActive,
            directorConfirmed: isDirectorshipAccepted,
            name,
            logo,
            country,
            proofsQty,
            isWebsiteProved,
            isSslProved,
            isSocialFBProved,
            isSocialTWProved,
            isSocialIGProved,
            isSocialLNProved,
            isJsonValid,
            jsonContent,
            orgJsonHash,
            orgJsonUri,
            jsonCheckedAt: new Date().toJSON(),
            jsonUpdatedAt: new Date().toJSON()
        };
    };

    const refreshOrganization = async (web3, orgidContract, address, orgIdResolver) => {
        const organization = await parseOrganization(
            web3,
            orgidContract,
            address,
            orgIdResolver
        );
        // console.log(JSON.stringify(organization, null, 2));
        await cached.upsertOrgid(organization);
    };

    // Retrieve ALL organizations
    const getOrganizationsList = () => {
        return orgidContract.methods.getOrganizations(false).call();
    };

    const scrapeOrganizations = async () => {
        const organizations = await getOrganizationsList();

        log.info('Scrape organizations:', organizations);

        for (const orgid of organizations) {

            let organization = {};
            try {
                organization = await parseOrganization(
                    web3,
                    orgidContract,
                    orgid,
                    orgIdResolver
                );

                log.debug(organization);

                await cached.upsertOrgid(organization);
            } catch (e) {
                log.warn('Error during parseOrganization / upsertOrgid', e.toString());
            }

            if (organization.subsidiaries) {
                log.info('PARSE SUBSIDIARIES:', JSON.stringify(organization.subsidiaries));

                for (let orgid of organization.subsidiaries) {
                    try {
                        let subOrganization = await parseOrganization(
                            web3,
                            orgidContract,
                            orgid,
                            orgIdResolver
                        );
                        await cached.upsertOrgid(subOrganization);
                    } catch (e) {
                        log.warn('Error during [SubOrg] parseOrganization / upsertOrgid', e.toString());
                    }
                }
            }
        }
    };

    return Promise.resolve({
        isConnected: () => isConnected,
        isReconnection: () => isReconnection,
        scrapeOrganizations,
        listenEvents,
        refreshOrganization: async (address) => refreshOrganization(
            web3,
            orgidContract,
            address,
            orgIdResolver
        ),
        cached
    });
};
