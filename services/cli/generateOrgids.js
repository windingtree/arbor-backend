const _ = require('lodash');
const chalk = require('chalk');
const commandLineArgs = require('command-line-args');
const { loadMainModuleSystem } = require('../../loadMainModules');

const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'trace';

const optionDefinitions = [
    { name: 'env', alias: 'e', type: String },
    { name: 'qty', alias: 'q', type: Number },
];
const cliOptions = commandLineArgs(optionDefinitions);

const { env, qty } = cliOptions;

(async () => {
    const {config, cached} = await loadMainModuleSystem();
    console.log(JSON.stringify(config().modificationTime, null, 2));

    for(let i = 0; i < qty; i++) {
        // @todo: generate typical org id content with deviations
        const orgJson = {
            // ...
        };
        const organizationPayload = {
            address: '...',
            owner: '...',
            environment: env,
            orgJsonUri: '...',
            orgJsonHash: '...',
            orgJsonContent: '...',
            dateCreated: '...',
            dateUpdated: '...'
        };
        await cached.loadOrganizationIntoDB(organizationPayload);
    }

    process.exit(0);
})();
