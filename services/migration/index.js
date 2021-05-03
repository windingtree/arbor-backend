const axios = require('axios');
const IpfsHttpClient = require('ipfs-http-client');
const { urlSource } = IpfsHttpClient;
const Web3 = require('web3');
const {
    OrgIdContract,
    addresses
} = require('@windingtree/org.id');
const config = require('../../modules/config/lib/3rd-party.json');
const { getDeepValue } = require('./object');
const {
    network,
    provider
} = config.environments[config.currentEnvironment];
const orgIdAddress = addresses[network.replace('mainnet', 'main')];

// Web setup
const web3 = new Web3(provider);
const orgIdContract = new web3.eth.Contract(
    OrgIdContract.abi,
    orgIdAddress
);

// IPFS client setup
const ipfsStorageNode = 'https://staging-ipfs.marketplace.windingtree.com'; // Use an actual IPFS server host here
const ipfsStorageClient = IpfsHttpClient(ipfsStorageNode);

// Allowed domains
const uris = [
    'windingtree.com',
    'arbor.fm'
].join('|');

const main = async () => {
    try {
        const organizations = await orgIdContract.methods
            .getOrganizations(false).call();
        // console.log(`Fetched ORGiDs: ${organizations.length}`);

        const orgJsonLinks = await Promise.all(organizations.map(
            orgId => orgIdContract.methods
                .getOrganization(orgId).call()
        ));
        // console.log(`Fetched ORG.JSON links: ${orgJsonLinks.length}`);

        const filteredLinks = orgJsonLinks
            .filter(
                orgIdData => orgIdData.orgJsonUri.match(new RegExp(uris, 'i'))
            )
            .map(
                orgIdData => orgIdData.orgJsonUri.replace(
                    new RegExp('arbor.fm', 'i'),
                    'windingtree.com'
                )
            );
        // console.log(`Filtered ORG.JSON links: ${filteredLinks.length}`);

        const deployedFiles = (await Promise.all(filteredLinks.map(
            async jsonOrigUri => {
                try {
                    const jsonResult = await axios.get(jsonOrigUri, {
                        transformResponse: [data => data]
                    });
                    const jsonPin = await ipfsStorageClient.add(
                        jsonResult.data,
                        {
                            hashAlg: 'keccak-256',
                            cidVersion: 1,
                            pin: true
                        }
                    );
                    const jsonPinPath = `${ipfsStorageNode}/ipfs/${jsonPin.path}`;

                    const parsedJson = JSON.parse(jsonResult.data);
                    const logoOrigUri = getDeepValue(parsedJson, 'legalEntity.media.logo') ||
                        getDeepValue(parsedJson, 'organizationalUnit.media.logo');
                    let logoPin;
                    let logoPinPath;
                    if (logoOrigUri) {
                        try {
                            logoPin = await ipfsStorageClient.add(urlSource(logoOrigUri));
                            logoPinPath = `${ipfsStorageNode}/ipfs/${logoPin.cid.toString()}`;
                        } catch (error) {
                            // console.log(`${error.message}: ${logoOrigUri}`);
                        };
                    }

                    const orgId = {
                        id: parsedJson.id,
                        jsonOrigUri,
                        jsonPinPath,
                        jsonRewriteRule: `rewrite ${new URL(jsonOrigUri).pathname} ${new URL(jsonPinPath).href} permanent;`,
                        logoOrigUri,
                        logoPinPath,
                        logoRewriteRule: logoPinPath ? `rewrite ${new URL(logoOrigUri).pathname} ${new URL(logoPinPath).href} permanent;` : undefined
                    };
                    return orgId;
                } catch (error) {
                    // console.log(`${error.message}: ${jsonOrigUri}`);
                    return null;
                }
            }
        ))).filter(file => file);
        // console.log(`Deployed files: ${deployedFiles.length}`);
        console.log(deployedFiles.map(file => file.jsonRewriteRule).join('\n'));
        console.log(deployedFiles.map(file => file.logoRewriteRule ? file.logoRewriteRule : null)
            .filter(rule => rule)
            .join('\n'));

    } catch (error) {
        console.log(error);
    }
};

main();
