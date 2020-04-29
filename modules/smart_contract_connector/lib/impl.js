const _ = require('lodash');
const chalk = require('chalk');
const fetch = require('node-fetch');
const dns = require('dns');
const cheerio = require('cheerio');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

// SMART CONTRACTS
const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const OrgId = Contracts.getFromNodeModules('@windingtree/org.id', 'OrgId');
const LifDeposit = Contracts.getFromNodeModules('@windingtree/trust-clue-lif-deposit', 'LifDeposit');
const LifToken = Contracts.getFromNodeModules('@windingtree/lif-token', 'LifToken');

// Constants
const orgid0x = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Common web3 instance
const web3 = new Web3();

module.exports = function (config, cached) {
    
    const { currentEnvironment, environments } = config();
    const environment = environments[currentEnvironment];

    let connectionInterval;
    let connectionTimeout;

    const connectionGuard = () => {
        clearTimeout(connectionTimeout);
        clearInterval(connectionInterval);

        const connectionValidator = async () => {
            try {
                connectionTimeout = setTimeout(() => {
                    log.debug('Connection timeout. Going to reconnect');
                    setImmediate(connect);
                }, 5 * 1000);
                const blockNumber = await getCurrentBlockNumber();
                clearTimeout(connectionTimeout);
                // Save latest block number
            } catch (error) {
                log.error('Connection error:', error);
                setImmediate(connect);
            }
        };
        
        connectionInterval = setInterval(connectionValidator, 30 * 1000);
        connectionValidator();
    };

    const onConnected = () => {
        log.debug('WS Connected');
        connectionGuard();
        listenEvents();
    };

    const createProvider = environment => {
        log.debug('Attempting to connect...');
        const provider = new Web3.providers.WebsocketProvider(
            `wss://${environment.network}.infura.io/ws/v3/${environment.infuraId}`
        );
        web3.setProvider(provider);
        return provider;
    };

    const connect = () => {
        // Establish websocket and register to events
        const provider = createProvider(environment);

        // Subscribe to websocket error events
        provider.on('error', e => {
            log.debug('WS Connexion Error', e);
            setImmediate(connect);
        });

        // Subscribe to websocket connection errors
        provider.on('end', e => {
            log.debug(`WS closed, reason: ${e.closeDescription}`);
            setImmediate(connect);
        });
        
        if (provider.connection.readyState === provider.connection.OPEN) {
            onConnected();
        } else {
            provider.on('connect', onConnected);
        }
    };

    // Initial connection
    connect();

    // Cached version of the contracts for lazy loading
    var orgidContract;
    var lifDepositContract;
    var lifTokenContract;

    // Get the Organizations in DNS for the DNS Trust Clue
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

    // Get the Organizations in URL for the Domain Trust Clue
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

    // Get the current environment
    const getEnvironment = () => {
       return environment;
    };

    const getCurrentBlockNumber = async () => {
        //const { web3 } = getEnvironment();
        return new Promise((resolve, reject) => {
            web3.eth.getBlockNumber((err, data) => {
                if(err) return reject(err);
                resolve(data);
            });
        });
    };

    // Wait for a specific block number
    const waitForBlockNumber = async (blockNumber) => {
        let currentBlockNumber = 0;
        while(currentBlockNumber < blockNumber) {
            try {
                currentBlockNumber = await getCurrentBlockNumber();
                if(blockNumber < currentBlockNumber) break;
                await setTimeoutPromise(1000);
            } catch(e) {
                log.debug('<<< waitForBlockNumber', e.toString());
            }
        }
    };

    // Get the ORG.ID contract
    const getOrgidContract = () => {
        // Check if cached
        if (!orgidContract) {
            // Retrieve the instance
            orgidContract = OrgId.at(environment.orgidAddress);
            orgidContract.setProvider(web3.currentProvider);
        }
        
        return orgidContract
    };

    // Get the LIF Deposit contract
    const getLifDepositContract = () => {
        if (!lifDepositContract) {
            lifDepositContract = LifDeposit.at(environment.lifDepositAddress);
            lifDepositContract.setProvider(environment.web3.currentProvider);
        }
        return lifDepositContract;
    };

    // Get the LIF Token contract
    const getLifTokenContract = () => {
        if (!lifTokenContract) {
           lifTokenContract = LifToken.at(environment.lifTokenAddress);
            lifTokenContract.setProvider(environment.web3.currentProvider); 
        }
        return lifTokenContract;
    };

    // Retrieve ALL organizations
    const getOrganizationsList = async () => {
        let orgidContract = getOrgidContract();
        return orgidContract.methods.getOrganizations().call();
    };

    // Retrieve the details of one organization
    const getOrganization = (orgid) => {
        return new Promise((resolve, reject) => {
            let orgidContract = getOrgidContract();
            orgidContract.methods.getOrganization(orgid)
            .call()
            .then(resolve)
            .catch(reject);
        });
    };


    // Get an organization with retry attempts
    const getOrganizationWithRetry = (orgid, attempts = 5) => {
        return new Promise((resolve, reject) => {
            // Check if we reached maximum attempts
            if(attempts == 0) {
                reject("Organization not retrieved after max attemps");
            }

            // Retrieve organization
            getOrganization(orgid)
            .then(organization => {

                // Check if organization exists
                if(organization.exist) {
                    resolve(organization);
                }

                // Otherwise, attempt again later
                setTimeout(() => {
                    getOrganizationWithRetry(orgid, attempts - 1)
                    .then(resolve)
                    .catch(reject);
                }, 2*1000);

            })
            .catch(reject);
        });
    };

    // Get the subsidaries of an orgid
    const getSubsidiaries = (orgid) => {
        return new Promise((resolve, reject) => {
            let orgidContract = getOrgidContract();
            orgidContract.methods.getSubsidiaries(orgid)
            .call()
            .then(resolve)
            .catch(reject);
        });
    };

    // Get the ORG.ID from Facebook post
    const getOrgIdFromFacebookPost = (socialUrl) => {
        return new Promise(async (resolve) => {
            try {
                const orgJsonResponse = await fetch(socialUrl);
                process.stdout.write('[FB::READ-OK]\n');
                const orgJsonText = await orgJsonResponse.text();
                let $ = cheerio.load(orgJsonText);
                let insideCode = '', $code, post = '', i = 0;
                do {
                    insideCode = $(`.hidden_elem > code`).eq(i++).html().replace('<!--', '').replace('-->', '').replace('\"', '"');
                    $code = cheerio.load(insideCode);
                    post = $code('[data-testid="post_message"] > div > p').html();
                } while (!!$code && !post && i<20);
                if(!post) return resolve(false);
                const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
                resolve(orgid)
            } catch (e) {
                log.warn('Error during getOrgIdFromFacebookPost:', e.toString());
                resolve(false)
            }
        })
    };

    // Get the ORG.ID from Twitter post
    const getOrgIdFromTwitterPost = (socialUrl) => {
        return new Promise(async (resolve) => {
            try {
                const orgJsonResponse = await fetch(socialUrl);
                process.stdout.write('[WT::READ-OK]\n');
                const orgJsonText = await orgJsonResponse.text();
                const $ = cheerio.load(orgJsonText);
                const post = $(`.js-tweet-text`).text();
                if(!post) return resolve(false);
                const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
                resolve(orgid)
            } catch (e) {
                log.warn('Error during getOrgIdFromFacebookPost:', e.toString());
                resolve(false)
            }
        })
    };

    // Parse the JSON of an organization
    const parseOrganizationJson = async (orgJsonUri, orgJsonHash) => {
        // Bypass for localhost issue
        // @fixme: to be removed
        if(orgJsonUri.substr(0,22) == 'https://localhost:3333') {
            orgJsonUri = 'https://staging-api.arbor.fm' + orgJsonUri.substr(22);
            log.debug(`Replace URI -> ${orgJsonUri}`);
        }

        // Retrieve off-chain JSON and validate hash
        let jsonContent, orgJsonHashCalculated, isJsonValid, autoCache;
        try {
            let orgJsonResponse = await fetch(orgJsonUri);
            let orgJsonText = await orgJsonResponse.text();
            orgJsonHashCalculated = Web3.utils.keccak256(orgJsonText);
            jsonContent = JSON.parse(orgJsonText);
            autoCache = Web3.utils.keccak256(JSON.stringify(jsonContent, null, 2));
            isJsonValid = (orgJsonHashCalculated === orgJsonHash) || (autoCache === orgJsonHash);
        } catch (e) {
            log.debug('[ERROR]\n');
            log.debug(e.toString());
        }

        // Validation of JSON content
        if (!jsonContent) {
            log.error('Error Resolving JSON content', e.toString());
        }
        if (!isJsonValid) {
            log.error(`(got hash=${chalk.red(orgJsonHashCalculated === autoCache ? autoCache : `${orgJsonHashCalculated} ~ ${autoCache}`)} BUT expected ${chalk.green(orgJsonHash)}) for uri ${orgJsonUri}`);
        }
        return jsonContent;
    }

    // Parse an organization
    const parseOrganization = async (orgid) => {
        log.debug('[.]', chalk.blue('parseOrganization'), orgid, typeof orgid);

        // Get the Organization data from the smart contract
        let organization;
        try {
            organization = await getOrganizationWithRetry(orgid);
        }
        catch(e) {
            log.error(e.toString());
            return {};
        }
        
        log.debug(`Organization Details: ${JSON.stringify(organization)}`);
        let owner = organization.owner;
        let director = organization.director;
        let state = organization.state;
        let directorConfirmed = organization.directorConfirmed;

        // Retrieve the details on the parent
        let parent;
        if (organization.parentEntity !== orgid0x) {
            // Attempt to retrieve parent
            try {
                // Retrieve Parent Organization Details
                let parentOrganization = await parseOrganization(organization.parentEntity);

                // Retrieve parent details
                parent = {
                    orgid: organization.parentEntity,
                    name: parentOrganization.name,
                    proofsQty: parentOrganization.proofsQty || 0
                }
            }

            // In case of error, just log but do not prevent the rest of the resolution
            catch (e) {
                log.error('Error Resolving parent', e.toString());
                organization.parentEntity = orgid0x;
                parent = undefined;
            }

        }

        // Retrieve the subsidiaries
        let subsidiaries = [];
        if(organization.parentEntity == orgid0x) {
            subsidiaries = await getSubsidiaries(orgid);
        }

        // Retrieve the offchain data
        let jsonContent= await parseOrganizationJson(organization.orgJsonUri, organization.orgJsonHash);
        if(!jsonContent) {
            log.error('Error Resolving JSON content', e.toString());
            throw("Organization resolution aborted due to error retrieving JSON content"); 
        }

        // Retrieve OrgID Type
        let orgidType = 'unknown';
        if(jsonContent.legalEntity) {
            orgidType = 'legalEntity';
        } else if(jsonContent.organizationalUnit) {
            orgidType = 'organizationalUnit';
        }

        // Retrieve Directory
        let directory = 'unknown';
        if(orgidType == 'legalEntity') {
            directory = 'legalEntity';
        } else if(orgidType == 'organizationalUnit') {
            directory = jsonContent.organizationalUnit.type;
            // Directory should be an array
            // But Database expects a string
            if(Array.isArray(directory)) {
                // Backward compatibility for Arbor BE
                if(directory.length === 1) {
                    directory = directory[0];
                } else {
                    directory = JSON.stringify(directory);
                }
            }
        }
        
        // Retrieve name
        let name = 'Name is not defined';
        if(orgidType == 'legalEntity') {
            name = jsonContent.legalEntity.legalName;
        } else if(orgidType == 'organizationalUnit') {
            name = jsonContent.organizationalUnit.name;
        }

        // Retrieve country
        let country;
        if(orgidType == 'legalEntity' && jsonContent.legalEntity.registeredAddress) {
            country = jsonContent.legalEntity.registeredAddress.country;

        } else if(orgidType == 'organizationalUnit' && jsonContent.organizationalUnit.address) {
            country = jsonContent.organizationalUnit.address.country;
        }
        if(country && country.length !== 2) {
            country = '';
        }

        // Retrieve logo
        let logo;
        if(jsonContent.media) {
            logo = jsonContent.media.logo;
        }

        // Retrieve contacts
        let contacts = _.get(jsonContent, `${orgidType}.contacts[0]`, {});

        // Check the LIF deposit amount
        //const orgIdLifDepositAmount = parseFloat(`${organization.deposit.substr(0, organization.deposit.length - lifDecimals)}.${organization.deposit.substr(organization.deposit.length - lifDecimals)}`);
        let lifDeposit = web3.utils.fromWei(organization.deposit, 'ether');
        let isLifProved =  lifDeposit >= environment.lifMinimumDeposit;

        // Facebook Trust clue
        let isSocialFBProved = false;
        const trustFacebookUri = _.get(_.filter(_.get(jsonContent, `trust`, []), (clue) => ['social', 'facebook'].indexOf(clue.type) !== -1 && clue.proof.indexOf('facebook') !== -1), '[0].proof', false);
        if (trustFacebookUri) {
            isSocialFBProved =  (await getOrgIdFromFacebookPost(trustFacebookUri)) === orgid;
        }
        
        // Twitter Trust clue
        let isSocialTWProved = false;
        const trustTwitterUri = _.get(_.filter(_.get(jsonContent, `trust`, []), (clue) => ['social', 'twitter'].indexOf(clue.type) !== -1 && clue.proof.indexOf('twitter') !== -1), '[0].proof', false);
        if (trustTwitterUri) {
            isSocialTWProved =  (await getOrgIdFromTwitterPost(trustFacebookUri)) === orgid;
        }

        // Instagram Trust clue
        // @fixme to be implemented
        let isSocialIGProved = false;

        // Linkedin Trust clue
        // @fixme to be implemented
        let isSocialLNProved = false;

        // Overall Social Trust proof
        let isSocialProved = isSocialFBProved || isSocialTWProved || isSocialIGProved || isSocialLNProved;

        // Website Trust clue
        const {website} = contacts;
        const isWebsiteProved = (orgid === (await getOrgidFromLink(website)));

        // SSL Trust clue
        let isSslProved = false;
        if (isWebsiteProved) isSslProved = checkSslByUrl(website);
        
        // Retrurn all details
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
            isSocialFBProved,
            isSocialTWProved,
            isSocialIGProved,
            //isJsonValid,
            //orgJsonHash,
            //orgJsonUri,
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
                log.debug(organization);
                await cached.upsertOrgid(organization);
            } catch (e) {
                log.warn('Error during parseOrganization / upsertOrgid', e.toString());
            }

            if (organization.subsidiaries) {
                log.info('PARSE SUBSIDIARIES:', JSON.stringify(organization.subsidiaries));
                for(let orgid of organization.subsidiaries) {
                    try {
                        let subOrganization = await parseOrganization(orgid);
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
        await waitForBlockNumber(event.blockNumber);
        try {
            log.debug(event.event ? event.event : event.raw, event.returnValues);
            let organization, subOrganization;
            switch (event.event) {
                case "OrganizationCreated":
                case "OrganizationOwnershipTransferred":
                case "OrgJsonUriChanged":
                case "OrgJsonHashChanged":
                case "LifDepositAdded":     // event LifDepositAdded    (bytes32 indexed orgId, address indexed sender, uint256 value);
                case "WithdrawalRequested": // event WithdrawalRequested(bytes32 indexed orgId, address indexed sender, uint256 value, uint256 withdrawTime);
                case "DepositWithdrawn":    // event DepositWithdrawn   (bytes32 indexed orgId, address indexed sender, uint256 value);
                    organization = await parseOrganization(event.returnValues.orgId);
                    log.info(JSON.stringify(organization));
                    await cached.upsertOrgid(organization);
                    break;
                
                // Event fired when a subsidary is created
                case "SubsidiaryCreated":
                    parentOrganization = await parseOrganization(event.returnValues.parentOrgId);
                    subOrganization = await parseOrganization(event.returnValues.subOrgId);
                    await cached.upsertOrgid(parentOrganization);
                    await cached.upsertOrgid(subOrganization);
                    log.info(JSON.stringify(parentOrganization));
                    log.info(JSON.stringify(subOrganization));
                    
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

    // Retrieve past events (for restart/recovery)
    const recoverPastEvents = (currentBlockNumber) => {
        return new Promise((resolve, reject) => {
            const orgidContract = getOrgidContract();

            // Get the last events
            orgidContract.getPastEvents("allEvents",{
                fromBlock: currentBlockNumber - 500,
                toBlock: currentBlockNumber - 1
            })
            
            // Process the past events
            .then(events => {
                let remaining = events.length;
                events.forEach(event => {
                    resolveOrgidEvent(event)
                    .then(()=>{
                        remaining--;
                        if(remaining == 0) {
                            resolve();
                        }
                    })
                    .catch(reject);
                });
            })
        });
    };

    const listenEvents = async () => {
        try {
            const orgidContract = getOrgidContract();
            let currentBlockNumber = await getCurrentBlockNumber();
            log.debug(`Recovering Past events`);
            await recoverPastEvents(currentBlockNumber);

            log.debug(`Subscribing to events for Orgid Contract ${orgidContract.options.address}`);
            log.debug(`event listening started...${chalk.grey(`(from block ${currentBlockNumber})`)}`);
            
            // Start Listening on all Events
            orgidContract.events.allEvents({ 
                fromBlock: currentBlockNumber
            })

            // Connection established
            .on("connected", (subscriptionId) => {
                log.debug(`Connected with ${subscriptionId}`);
            })

            // Event Received
            .on('data', resolveOrgidEvent)

            // Change event
            .on('changed', (event) => log.debug("=================== Changed ===================\r\n", event))

            // Error Event
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
