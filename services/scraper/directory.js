const Web3 = require('web3');
const lib = require('zos-lib');
const Contracts = lib.Contracts;
const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');

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

module.exports = {
    prepareToScrapeDirectory,
};
