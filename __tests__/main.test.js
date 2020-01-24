const log4js = require('log4js');

const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
const Web3 = require('web3');
log.level = 'debug';


const {loadMainModuleSystem} = require('./loadMainModules');

(async () => {
    const {config, models, smart_contract_connector, cached} = await loadMainModuleSystem();
    console.log(JSON.stringify(config().modificationTime, null, 2));

    // madrid
    let environment = {
        entrypoint: '0xa268937c2573e2AB274BF6d96e88FfE0827F0D4D',
        lifDeposit: '0xfCfD5E296E4eD50B5F261b11818c50B73ED6c89E',
        provider: 'https://ropsten.infura.io/v3/7697444efe2e4751bc2f20f7f4549c36',
        active: true,
    };
})();


describe("cached module", () => {

});