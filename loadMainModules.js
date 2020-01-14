console.log('  ');
console.log(' _____                           _  ___  ___          _       _');
console.log('|  __ \\                         | | |  \\/  |         | |     | |   ');
console.log('| |  \\/ ___ _ __   ___ _ __ __ _| | | .  . | ___   __| |_   _| | ___  ___ ');
console.log('| | __ / _ \\ \'_ \\ / _ \\ \'__/ _` | | | |\\/| |/ _ \\ / _` | | | | |/ _ \\/ __|');
console.log('| |_\\ \\  __/ | | |  __/ | | (_| | | | |  | | (_) | (_| | |_| | |  __/\\__ \\');
console.log(' \\____/\\___|_| |_|\\___|_|  \\__,_|_| \\_|  |_/\\___/ \\__,_|\\__,_|_|\\___||___/');
console.log('  ');

const bootstrap = require('./bootstrap');
const configModule = require('./modules/config');
const log4js = require('log4js');
const log = require('log4js').getLogger('main-modules');
log.level = 'trace';
log4js.configure({
    appenders: { cheese: { type: 'console' } },
    categories: { default: { appenders: ['cheese'], level: 'trace' } }
});

log.debug('going to run ./modules/config ');

let impl = {};
let loaded = false;

(async () => {
    try {
        const configFn = await configModule([{ modules_config: 'main_modules_config' }], { impl: 'modules-config' });
        const predefinedModules = {};
        const ctx = await bootstrap(configFn, predefinedModules);
        log.info('Modules loaded:', JSON.stringify(Object.keys(ctx)));
        Object.assign(impl, ctx);
        loaded = true;
    } catch (e) {
        log.error(e);
        process.exit(9);
    }
})();

exports.loadMainModuleSystem = () => {
    return new Promise(function (resolve, reject) {
        if (loaded) resolve(impl);
        const interval = setInterval(() => {
            if (loaded) {
                clearInterval(interval);
                resolve(impl);
            }
        }, 200);
    });
};
