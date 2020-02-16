const fs = require('fs');
const { keccak256 } = require('js-sha3');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

module.exports = function (config) {
    const mkdir = async (path, options) => {
        return new Promise((resolve, reject) => {
            fs.mkdir(path, options, (err) => {
                if (err) return reject(err);
                resolve();
            });
        })
    };

    const writeFile = async (dir, file, content) => {
        await mkdir(dir, { recursive: true });
        fs.writeFileSync(dir + file, content);
    };

    const saveJson = async (address, orgidJson, baseUrl) => {
        console.log('saveJson', address, 'orgidJson...');
        const orgidJsonString = JSON.stringify(orgidJson, null, 2);
        const dir = `uploads/${address}/${orgidJson.id ? `${orgidJson.id}/` : ''}`;
        const file = `${orgidJson.id ? '' : 'wizard-'}0x${keccak256(orgidJsonString)}.json`;
        await writeFile(dir, file, orgidJsonString);
        return `${baseUrl}${dir}${file}`;
    };

    return Promise.resolve({
        saveJson
    });
};
