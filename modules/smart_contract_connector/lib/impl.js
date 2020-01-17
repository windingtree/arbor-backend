const _ = require('lodash');
const chalk = require('chalk');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

const fetch = require('node-fetch');
const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const Organization = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'Organization');
const LifDeposit = Contracts.getFromNodeModules('@windingtree/trust-clue-lif-deposit', 'LifDeposit');
const Entrypoint = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'WindingTreeEntrypoint');
const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');

module.exports = function (config, cached) {

    const scrapeOrganization = async (orgAddress, segments, envName, providerAddress, lifDepositAddress) => {
        process.stdout.write(`Scraping organization ${orgAddress}: `);
        const res = {
            environment: envName,
            segments: segments,
            address: orgAddress,
        };

        // on-chain
        process.stdout.write('on-chain... ');
        const provider = new Web3.providers.HttpProvider(providerAddress);
        const web3 = new Web3(provider);
        const organization = Organization.at(orgAddress);
        organization.setProvider(web3.currentProvider);

        res.orgid = await organization.methods.owner().call();
        res.orgJsonUri = await organization.methods.orgJsonUri().call();
        res.orgJsonHash = await organization.methods.orgJsonHash().call();
        const createdBlock = await organization.methods.created().call();
        const createdTimestamp = (await web3.eth.getBlock(createdBlock)).timestamp;
        res.dateCreated = new Date(createdTimestamp * 1000);
        const associatedKeys = await organization.methods.getAssociatedKeys().call();
        associatedKeys.shift(); // remove zeroeth item
        res.associatedKeys = associatedKeys.join(',');

        // off-chain
        process.stdout.write('off-chain... ');
        const orgJsonResponse = await fetch(res.orgJsonUri);
        const orgJsonText = await orgJsonResponse.text();

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
        log.info(JSON.stringify(res, null, 2));

        await cached.loadOrganizationIntoDB(res);



        //await Snapshot.upsert(res);

        console.log('done.');

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

        const entrypoint = Entrypoint.at(environment.entrypoint);
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



    return Promise.resolve({
        scrapeEnvironment,
        visibleForTests: {
            scrapeOrganization,
            prepareToScrapeDirectory
        }
    });
};
