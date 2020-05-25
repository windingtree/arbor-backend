const { loadMainModuleSystem } = require('../../loadMainModules');
const { setTimeoutPromise } = require('../../modules/smart_contract_connector/lib/utils');

const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'trace';

/*
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
    { name: 'env', alias: 'e', type: String },
];
const cliOptions = commandLineArgs(optionDefinitions);
const { env } = cliOptions;
*/


(async () => {
    try {
        const {config, smart_contract_connector} = await loadMainModuleSystem();
        console.log(JSON.stringify(config().modificationTime, null, 2));
        await setTimeoutPromise(10000);
        await smart_contract_connector.scrapeOrganizations();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
