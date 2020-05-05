const { OrgIdResolver, httpFetchMethod } = require('@windingtree/org.id-resolver');
// const dns = require('dns');
const log = require('log4js').getLogger('smart_contracts_connector:utils');
log.level = 'debug';

const setTimeoutPromise = timeout => new Promise(resolve => setTimeout(resolve, timeout));
module.exports.setTimeoutPromise = setTimeoutPromise;

// Get current block number
module.exports.getCurrentBlockNumber = async web3 => {
    let counter = 0;
    let blockNumber;

    const blockNumberRequest = () => new Promise(resolve => {
        const blockNumberTimeout = setTimeout(resolve, 2000);

        try {
            web3.eth.getBlockNumber((error, result) => {
                clearTimeout(blockNumberTimeout);

                if (error) {
                    return resolve();
                }

                resolve(result);
            });
        } catch (error) {
            // ignore errors due because of we will be doing retries
        }
    });

    do {
        if (!web3.currentProvider.connected) {
            throw new Error('Unable to fetch blockNumber: no connection');
        }

        if (counter === 10) {
            throw new Error('Unable to fetch blockNumber: retries limit has been reached');
        }

        blockNumber = await blockNumberRequest();

        if (typeof blockNumber !== 'number') {
            await setTimeoutPromise(1000);
        }

        counter++;
    } while (typeof blockNumber !== 'number');

    return blockNumber;
};

// Wait for a specific block number
const waitForBlockNumber = async (web3, blockNumber) => {
    let currentBlockNumber = 0;

    while (currentBlockNumber < blockNumber) {

        try {
            currentBlockNumber = await getCurrentBlockNumber(web3);

            if (blockNumber < currentBlockNumber) {
                break;
            }

            await setTimeoutPromise(1000);
        } catch(error) {
            log.debug('waitForBlockNumber', error.toString());
        }
    }
};
module.exports.waitForBlockNumber = waitForBlockNumber;

// orgid-resolver creation helper
module.exports.createResolver = (web3, orgIdAddress) => {
    const resolver = new OrgIdResolver({
        web3, 
        orgId: orgIdAddress
    });
    resolver.registerFetchMethod(httpFetchMethod);
    return resolver;
};

// Extract assertion from orgid-resolver result
module.exports.getTrustAssertsion = (resolverResult, type, calim) => {

    if (!resolverResult.trust || !resolverResult.trust.assertions) {
        return false;
    }

    return resolverResult.trust.assertions
        .filter(a = a.type === type && a.claim.match(new RegExp(`${calim}`, 'i')))
        .reduce(r => {
            if (r[1].verified) {
                return true;
            }

            return false;
        }, false);
};

const checkSslByUrl = (link, expectedLegalName) => new Promise(async (resolve) => {
       
    if (link.indexOf('://') === -1) {
        link = `https://${link}`;
    }

    let requestSsl;

    try {
        let { hostname } = new URL(link);
        let isAuthorized = false;
        const options = {
            host: hostname,
            method: 'get',
            path: '/',
            agent: new https.Agent({ maxCachedSessions: 0 }) 
        };
        let companySiteHostnameFromServer;
        let legalNameFromServer;
        requestSsl = https.request(options, (response) => {
            let subject = response.socket.getPeerCertificate().subject;
            let CN = subject.CN.replace('*.','');

            if (CN.indexOf('://') === -1) {
                CN = `https://${CN}`;
            }

            companySiteHostnameFromServer = new URL(CN).hostname;
            legalNameFromServer = subject.O;

            log.debug(companySiteHostnameFromServer, legalNameFromServer);

            isAuthorized = response.socket.authorized;
            resolve(
                isAuthorized &&
                (legalNameFromServer === expectedLegalName) &&
                (companySiteHostnameFromServer === hostname)
            )
        });
        requestSsl.end();
    } catch (e) {
        log.debug('checkSslByUrl [ERROR]', e.toString());

        resolve(false)
    }
});
module.exports.checkSslByUrl = checkSslByUrl;

// // Get the Organizations in DNS for the DNS Trust Clue
// const getOrgidFromDns = async (link) => new Promise((resolve) => {
//     try {

//         if (link.indexOf('://') === -1) {
//             link = `https://${link}`;
//         }

//         const myURL = new URL(link);
//         dns.resolveTxt(myURL.hostname, (err, data) => {

//             if (err) {
//                 return resolve(undefined);
//             }

//             let orgid = _.get(
//                 _.filter(
//                     data,
//                     record => record && record.length && record[0].indexOf('orgid=') === 0
//                 ),
//                 '[0][0]',
//                 false
//             );

//             if (orgid) {
//                 orgid = orgid.replace('orgid=', '').replace('did:orgid:');
//             }

//             return resolve(orgid);
//         });
//     } catch (e) {
//         resolve(false)
//     }
// });

// // Get the ORG.ID from Facebook post
// const getOrgIdFromFacebookPost = socialUrl => new Promise(async (resolve) => {

//     try {
//         const orgJsonResponse = await fetch(socialUrl);
//         process.stdout.write('[FB::READ-OK]\n');
//         const orgJsonText = await orgJsonResponse.text();
//         const $ = cheerio.load(orgJsonText);
//         let insideCode = '';
//         let $code;
//         let post = '';
//         const i = 0;

//         do {
//             insideCode = $(`.hidden_elem > code`)
//                 .eq(i++)
//                 .html()
//                 .replace('<!--', '')
//                 .replace('-->', '')
//                 .replace('\"', '"');
//             $code = cheerio.load(insideCode);
//             post = $code('[data-testid="post_message"] > div > p').html();
//         } while (!!$code && !post && i < 20);

//         if (!post) {
//             return resolve(false);
//         }

//         const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
//         resolve(orgid)
//     } catch (e) {
//         log.warn('Error during getOrgIdFromFacebookPost:', e.toString());

//         resolve(false);
//     }
// });

// // Get the ORG.ID from Twitter post
// const getOrgIdFromTwitterPost = (socialUrl) => new Promise(async (resolve) => {
//     try {
//         const orgJsonResponse = await fetch(socialUrl);
//         process.stdout.write('[WT::READ-OK]\n');
//         const orgJsonText = await orgJsonResponse.text();
//         const $ = cheerio.load(orgJsonText);
//         const post = $(`.js-tweet-text`).text();

//         if (!post) {
//             return resolve(false);
//         }

//         const [orgid] = post.match(/0x[0-9ABCDEFabcdef]{64}/) || [false];
//         resolve(orgid)
//     } catch (e) {
//         log.warn('Error during getOrgIdFromFacebookPost:', e.toString());

//         resolve(false)
//     }
// });