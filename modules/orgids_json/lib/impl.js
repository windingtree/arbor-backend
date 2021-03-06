const fs = require('fs');
const Web3 = require('web3');
const IpfsHttpClient = require('ipfs-http-client');
const { globSource } = IpfsHttpClient;
const { keccak256 } = require('js-sha3');
const log = require('log4js').getLogger('Orgid_json');
log.level = 'debug';

module.exports = function (config) {
    const { currentEnvironment, environments } = config();
    const environment = environments[process.env.NODE_ENV === 'dev' ? 'development' : currentEnvironment];
    const ipfsStorageNodeUri = environment.ipfsStorageNode || 'https://ipfs.infura.io:5001'
    const ipfsPinningNodesUris = environment.ipfsPinningNodes || ['https://api.thegraph.com/ipfs/api/v0/']

    const mkdir = async (path, options) => {
        return new Promise((resolve, reject) => {
            fs.mkdir(path, options, (err) => {
                if (err) return reject(err);
                resolve();
            });
        })
    };

    const writeFile = async (dir, fileName, content) => {
        await mkdir(dir, {recursive: true});
        fs.writeFileSync(dir + fileName, content);
    };

    const storeIpfs = async (content, noKeccak) => {
        // Store in IPFS
        const ipfsStorageClient = IpfsHttpClient(ipfsStorageNodeUri);
        let pin = await ipfsStorageClient.add(content, {
            ...(!noKeccak ? {
                hashAlg: 'keccak-256',
                cidVersion: 1
            } : {}),
            pin: true
        });
        log.debug('IPFS pin:', pin);

        // // Pin in alternative IPFS nodes
        // ipfsPinningNodesUris.forEach(async uri => {
        //     const ipfsPinningClient = IpfsHttpClient(uri);
        //     try {
        //         await ipfsPinningClient.pin.add(pin.cid);
        //     } catch(e) {
        //         log.warn(e);
        //     }
        // });

        return `${ipfsStorageNodeUri}/ipfs/${pin.path}`;
    };

    const storeMediaToIpfs = async (pathToFile) => {
        const ipfsStorageClient = IpfsHttpClient(ipfsStorageNodeUri);
        const pin = await ipfsStorageClient.add(globSource(pathToFile));
        return `${ipfsStorageNodeUri}/ipfs/${pin.cid.toString()}`;
    };

    const removeIpfs = path => {
        const ipfsStorageClient = IpfsHttpClient(ipfsStorageNodeUri);
        return ipfsStorageClient.pin.rm(path);
    };

    const copyFromTemp = async (dir, fileName, content) => {
        await mkdir(dir, {recursive: true});
        await fs.copyFile(content.path, dir + fileName, (error, _) => {
            if (error) {
                log.debug(error.message)
            }
            fs.unlink(content.path, (err) => {
                if (err) log.debug(err.message);
            });
        });
    };

    const saveJson = async (address, orgidJson, baseUrl) => {
        log.debug('saveJson', address, 'orgidJson...');
        const orgidJsonString = JSON.stringify(orgidJson, null, 2);
        const dir = `uploads/${address}/${orgidJson.id ? `${orgidJson.id}/` : ''}`;
        const fileName = `${orgidJson.id ? '' : 'wizard-'}0x${keccak256(orgidJsonString)}.json`;
        await writeFile(dir, fileName, orgidJsonString); // Just as backup

        if (environment.returnIpfsLink) {
            const path = await storeIpfs(orgidJsonString);
            return path; 
        } else {
            return `${baseUrl}${dir}${fileName}`;
        }
    };

    const saveMedia = async (mediaType, options, baseUrl) => {
        let {address, file, id} = options;
        log.debug(file);
        log.debug(`saveMedia(${mediaType}, ${address}), file, baseUrl`);
        if (id === "undefined") id = 'wizard';
        const dir = `uploads/${address}/mediaType/${id}/`;
        const fileName = file.originalname;

        let ipfsPath;

        if (environment.returnIpfsLink) {
            ipfsPath = storeMediaToIpfs(file.path);
        }

        //${keccak256(file)}
        await copyFromTemp(dir, fileName, file);// just for backup
        return ipfsPath ? ipfsPath : `${baseUrl}${dir}${fileName}`;
    };

    return Promise.resolve({
        saveJson,
        saveMedia,
        storeIpfs,
        storeMediaToIpfs,
        removeIpfs,
        environment: () => environment
    });
};
