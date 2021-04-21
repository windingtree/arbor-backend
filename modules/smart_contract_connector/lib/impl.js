const Web3 = require('web3');
const _ = require('lodash');
const chalk = require('chalk');
const sgMail = require('@sendgrid/mail');
const {
    waitForBlockNumber,
    createResolver,
    getTrustAssertsion,
    getCurrentBlockNumber,
    checkSslByUrl,
    SimpleQueue,
    fetchDirectoriesIndex,
    fetchDirectoryName,
    subscribeDirectoriesEvents,
    unsubscribeDirectoriesEvents,
    createToken,
    httpRequest
} = require('./utils');

// Web3 Connection Guard
const connectionGuard = require('./guard');

const log = require('log4js').getLogger('smart_contracts_connector');
log.level = 'debug';

// Constants
const orgid0x = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = (config, cached, orgidsjson) => {
    const { currentEnvironment, environments } = config();
    const environment = environments[process.env.NODE_ENV === 'dev' ? 'development' : currentEnvironment];
    sgMail.setApiKey(environment.sendgridApiKey);

    let web3;
    let orgIdResolver;
    let orgidContract;
    let eventsSubscription;
    let isConnected = false;
    let isReconnection = false;
    let dirsSubscriptions = [];

    // Start connection for events listener with guard
    connectionGuard(
        environment.wsProvider,
        // Disconnection handler
        () => {
            isConnected = false;
            isReconnection = true;
            if (environment.directoryIndexAddress) {
                unsubscribeDirectoriesEvents(dirsSubscriptions);
            }
        },
        // Connection handler
        async _web3 => {
            try {
                web3 = _web3;
                orgIdResolver = createResolver(
                    web3,
                    {
                        orgIdAddress: environment.orgidAddress,
                        twitterKey: environment.twitterKey,
                        authorizedTrustProofsIssuers: environment.authorizedTrustProofsIssuers
                    }
                );
                orgidContract = (await orgIdResolver.getOrgIdContract());
                eventsSubscription = await listenEvents(web3, orgidContract, orgIdResolver);
                if (environment.directoryIndexAddress) {
                    dirsSubscriptions = await startDirsSubscriptions(web3, environment.directoryIndexAddress);
                }
                isConnected = true;
                isReconnection = false;
            } catch (error) {
                isConnected = false;
                log.error('Before subscribe:', error)
            }
        }
    );

    const sendEmail = async (
        email,
        title,
        text,
        link
    ) => {
        const basePath = environment.network === 'ropsten' ? 'staging.arbor.fm' : 'marketplace.windingtree.com';
        const msg = {
            to: email,
            from: 'noreply@windingtree.com',
            subject: title,
            text: `${title}\n\n
                ${text}\n\n
                ${link}`,
            html: `<!DOCTYPE html
            PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: white;
                    font-style: normal;
                    font-weight: 500;
                    font-size: 16px;
                    line-height: 28px;
                    color: #5E666A;
                }
                .content {
                    margin-top: 52px;
                }
                .pad {
                    width: auto;
                }
                .center {
                    width: 600px;
                    max-width: 600px;
                }
                .line {
                    width: 100%;
                    border-bottom: 2px solid #E3F9EB;
                }
                .logo {

                }
                h1 {
                    font-family: Arial, Helvetica, sans-serif;
                    font-style: normal;
                    font-weight: 500;
                    font-size: 32px;
                    line-height: 52px;
                    color: #42424F;
                }
                .first {
                    margin-top: 52px;
                }
                .last {
                    margin-bottom: 52px;
                }
                .button {
                    display: flex;
                    flex-direction: row;
                    padding: 10px 20px;
                    border: 2px solid #3F4244;
                    box-sizing: border-box;
                    border-radius: 8px;
                    width: 217px;
                    height: 44px;
                    left: 80px;
                    top: 509px;
                    font-family: Arial, Helvetica, sans-serif;
                    font-style: normal;
                    font-weight: 600;
                    font-size: 16px;
                    line-height: 24px;
                    color: #3F4244;
                }
                a {
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td class="pad">&nbsp;</td>
                    <td class="center">
                        <div class="logo">
                            <img src="https://${basePath}/wlogo.png" />
                        </div>
                    </td>
                    <td class="pad">&nbsp;</td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        <h1>${title}</h1>
                        <div class="line"></div>
                    </td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        ${text}
                    </td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        <a href="https://${basePath}/${link}" target="_blank">
                            ${link}
                        </a>
                    </td>
                    <td></td>
                </tr>
            </table>
        </body>
        </html>`
        };
        await sgMail.send(msg);
        log.debug('Email Sent:', email, title);
    };

    const getOrgEmail = async orgId => {
        const organization = await cached.getOrgId(orgId);
        let contacts;
        let email;
        if (organization.orgidType === 'legalEntity') {
            contacts = organization.jsonContent.legalEntity &&
                organization.jsonContent.legalEntity.contacts &&
                organization.jsonContent.legalEntity.contacts.length > 0
                ? organization.jsonContent.legalEntity.contacts
                : null;
        } else if (organization.orgidType === 'organizationalUnit') {
            contacts = organization.jsonContent.organizationalUnit &&
                organization.jsonContent.organizationalUnit.contacts &&
                organization.jsonContent.organizationalUnit.contacts.length > 0
                ? organization.jsonContent.organizationalUnit.contacts
                : null;
        }

        if (contacts) {
            const emailContact = contacts.filter(c => c.email)[0];
            email = emailContact ? emailContact.email : undefined;
        }

        log.debug('Org Email:', orgId, email);

        return email;
    };

    const startDirsSubscriptions = async (web3, directoryIndexAddress) => {
        try {
            const directories = await fetchDirectoriesIndex(web3, directoryIndexAddress);
            let email;
            return subscribeDirectoriesEvents(web3, 'latest', directories, async event => {
                try {
                    let segment;
                    switch (event.event) {
                        case 'OrganizationChallenged':
                            // Send email to organization owner
                            email = await getOrgEmail(event.returnValues._organization);
                            if (email) {
                                await sendEmail(
                                    email,
                                    'Organization has been challenged',
                                    'Your organization has been challenged. You can see details and accept on the organization page.',
                                    `organization/${event.returnValues._organization}`
                                );
                            }
                            break;
                        case 'OrganizationAdded':
                            // Send email to organization owner
                            email = await getOrgEmail(event.returnValues._organization);
                            if (email) {
                                await sendEmail(
                                    email,
                                    'Organization has been added to the directory',
                                    `Your organization has been added to the directory ${event.address}. You can see details and accept on the organization page.`,
                                    `organization/${event.returnValues._organization}`
                                );
                            }
                            segment = await fetchDirectoryName(web3, event.address);
                            await cached.addDirectoryToOrganization(
                                event.returnValues._organization,
                                segment
                            );
                            break;
                        case 'OrganizationRemoved':
                            // Send email to organization owner
                            email = await getOrgEmail(event.returnValues._organization);
                            if (email) {
                                await sendEmail(
                                    email,
                                    'Organization has been removed from the directory',
                                    `Your organization has been removed from the directory ${event.address}. You can see details and accept on the organization page.`,
                                    `organization/${event.returnValues._organization}`
                                );
                            }
                            segment = await fetchDirectoryName(web3, event.address);
                            await cached.removeDirectoryFromOrganization(
                                event.returnValues._organization,
                                segment
                            );
                            break;
                        case 'OrganizationRequestRemoved':
                            // Send email to organization owner
                            email = await getOrgEmail(event.returnValues._organization);
                            if (email) {
                                await sendEmail(
                                    email,
                                    'Organization adding request has been removed',
                                    `Your request to the directory ${event.address} has been removed.`,
                                    `directories/requests/${event.address}`
                                );
                            }
                            break;
                        case 'Evidence':
                            break;
                        default:
                            // Ignore all other events
                    }
                } catch (error) {
                    log.error(error);
                }
            });
        } catch (error) {
            log.error('Error during startDirsSubscriptions', error.toString());
        }
    };

    // Queue for promises
    const queue = new SimpleQueue();

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

        // @note This block is commented because from now directories list is formed on the base of Kleros managed directories
        // if (orgidType === 'legalEntity') {
        //     directory = 'legalEntity';
        // } else if (orgidType === 'organizationalUnit') {
        //     directory = jsonContent.organizationalUnit.type;
        //     // Directory should be an array
        //     // But Database expects a string
        //     if (Array.isArray(directory)) {
        //         // Backward compatibility for Arbor BE
        //         if (directory.length === 1) {
        //             directory = directory[0];
        //         } else {
        //             directory = JSON.stringify(directory);
        //         }
        //     }
        // }

        // Retrieve name
        let name = 'Name is not defined';
        // Retrieve logo
        let logo;

        if (orgidType == 'legalEntity') {
            name = jsonContent.legalEntity.legalName;
            if (jsonContent.legalEntity.media) {
                logo = jsonContent.legalEntity.media.logo;
            }
        } else if (orgidType == 'organizationalUnit') {
            name = jsonContent.organizationalUnit.name;
            if (jsonContent.organizationalUnit.media) {
                logo = jsonContent.organizationalUnit.media.logo;
            }
        }

        // Retrieve country & logo
        let country;

        if (orgidType == 'legalEntity' && jsonContent.legalEntity.registeredAddress) {
            country = jsonContent.legalEntity.registeredAddress.country;

        } else if (orgidType == 'organizationalUnit' && jsonContent.organizationalUnit.address) {
            country = jsonContent.organizationalUnit.address.country;
        }

        if (country && country.length !== 2) {
            country = '';
        }

        // Facebook Trust clue
        const isSocialFBProved = getTrustAssertsion(resolverResult, 'social', 'facebook');

        // Twitter Trust clue
        const isSocialTWProved = getTrustAssertsion(resolverResult, 'social', 'twitter');

        // Linkedin Trust clue
        const isSocialLNProved = getTrustAssertsion(resolverResult, 'social', 'linkedin');

        // Telegram!!! (uses Instagram property as workaround)
        const isSocialIGProved = getTrustAssertsion(resolverResult, 'social', 'telegram');

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
        console.log('Proved:', {
            isSocialFBProved,
            isSocialTWProved,
            isSocialIGProved,
            isSocialLNProved
        })

        // Counting total count of proofs
        const proofsQty = _.compact([isWebsiteProved, isSslProved, isSocialProved]).length;

        // Retrieve the subsidiaries (if exists)
        let subsidiaries = await getUnits(orgidContract, orgid);

        // Return all the organization details
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

    const fetchHotelProfile = async hotelId => {
        const {
            windingTreeApiKey,
            windingTreeOrgId,
            roomsOrgId,
            roomsBasePath
        } = environment;

        const wtToken = createToken(
            `-----BEGIN EC PRIVATE KEY-----
${windingTreeApiKey}
-----END EC PRIVATE KEY-----`,
            `did:orgid:${windingTreeOrgId}`,
            'key1',
            `did:orgid:${roomsOrgId}`,
            '[]',
            '1 hour'
        );

        return httpRequest(
            roomsBasePath,
            `/hotel/${hotelId}`,
            'GET',
            {},
            {
              method: 'headers',
              data: {
                'Authorization': `Bearer ${wtToken}`
              }
            }
        );
    };

    return Promise.resolve({
        isConnected: () => isConnected,
        isReconnection: () => isReconnection,
        scrapeOrganizations,
        listenEvents,
        fetchHotelProfile,
        refreshOrganization: async (address) => refreshOrganization(
            web3,
            orgidContract,
            address,
            orgIdResolver
        ),
        cached,
        orgIdResolver: () => orgIdResolver,
        web3: () => web3,
        storeIpfs: orgidsjson.storeIpfs,
        removeIpfs: orgidsjson.removeIpfs
    });
};
