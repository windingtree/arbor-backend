console.log('  ');
console.log(`              ,---------------------------,`);
console.log(`              |  /---------------------\\  |`);
console.log(`              | |                       | |`);
console.log(`              | |     Arbor             | |`);
console.log(`              | |      Back-end         | |`);
console.log(`              | |       Server <3       | |`);
console.log(`              | |                       | |`);
console.log(`              |  \\_____________________/  |`);
console.log(`              |___________________________|`);
console.log(`            ,---\\_____     []     _______/------,`);
console.log(`          /         /______________\           /|`);
console.log(`        /___________________________________ /  | ___`);
console.log(`        |                                   |   |    )`);
console.log(`        |  _ _ _                 [-------]  |   |   (`);
console.log(`        |  o o o                 [-------]  |  /    _)_`);
console.log(`        |__________________________________ |/     /  /`);
console.log(`    /-------------------------------------/|      ( )/`);
console.log(`  /-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/ /`);
console.log(`/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/ /`);
console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
console.log('  ');

const bootstrap = require('./bootstrap');
const configModule = require('./modules/config');
const log4js = require('log4js');
const log = require('log4js').getLogger('server');
log.level = 'debug';
log4js.configure({
    appenders: { cheese: { type: 'console' } },
    categories: { default: { appenders: ['cheese'], level: 'trace' } }
});

(async () => {
    const configFn = await configModule([{ modules_config: 'server_modules_config' }], { impl: 'modules-config' });
    const predefinedModules = {};
    const ctx = await bootstrap(configFn, predefinedModules);
    log.info('Modules loaded:', JSON.stringify(Object.keys(ctx)));
    log.info('Init rest...');
    /*
    Add listener for orgs creation and update
    */
    ctx.rest.init();
    log.info('Done!');
})();
