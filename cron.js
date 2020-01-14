console.log('  ');
console.log('________/\\\\\\\\\\\\\\\\\\_        ____/\\\\\\\\\\\\\\\\\\_____        _______/\\\\\\\\\\______        __/\\\\\\\\\\_____/\\\\\\_          ');
console.log(' _____/\\\\\\////////__        __/\\\\\\///////\\\\\\___        _____/\\\\\\///\\\\\\____        _\\/\\\\\\\\\\\\___\\/\\\\\\_         ');
console.log('  ___/\\\\\\/___________        _\\/\\\\\\_____\\/\\\\\\___        ___/\\\\\\/__\\///\\\\\\__        _\\/\\\\\\/\\\\\\__\\/\\\\\\_        ');
console.log('   __/\\\\\\_____________        _\\/\\\\\\\\\\\\\\\\\\\\\\/____        __/\\\\\\______\\//\\\\\\_        _\\/\\\\\\//\\\\\\_\\/\\\\\\_       ');
console.log('    _\\/\\\\\\_____________        _\\/\\\\\\//////\\\\\\____        _\\/\\\\\\_______\\/\\\\\\_        _\\/\\\\\\\\//\\\\\\\\/\\\\\\_      ');
console.log('     _\\//\\\\\\____________        _\\/\\\\\\____\\//\\\\\\___        _\\//\\\\\\______/\\\\\\__        _\\/\\\\\\_\\//\\\\\\/\\\\\\_     ');
console.log('      __\\///\\\\\\__________        _\\/\\\\\\_____\\//\\\\\\__        __\\///\\\\\\__/\\\\\\____        _\\/\\\\\\__\\//\\\\\\\\\\\\_    ');
console.log('       ____\\////\\\\\\\\\\\\\\\\\\_        _\\/\\\\\\______\\//\\\\\\_        ____\\///\\\\\\\\\\/_____        _\\/\\\\\\___\\//\\\\\\\\\\_   ');
console.log('        _______\\/////////__        _\\///________\\///__        ______\\/////_______        _\\///_____\\/////__  ');
console.log('  ');

const log4js = require('log4js');
const log = require('log4js').getLogger('cron'.padEnd(40));
log.level = 'trace';
log4js.configure({
    appenders: { cheese: { type: 'console' } },
    categories: { default: { appenders: ['cheese'], level: 'trace' } }
});

log.debug('going to run ./modules/config ');
require('./modules/config')([{modules_config: 'cron_modules_config' }], { impl: 'modules-config' })
    .then((modulesConfig) => {
        const initialContext = {};
        return require('./bootstrap').init(modulesConfig, initialContext); // eslint-disable-line global-require
    })
    .then((ctx) => {
        log.info('Modules loaded:', JSON.stringify(Object.keys(ctx)));
        const { config, out, models, redis, notifications, funds, exchange } = ctx;
        // [FILL DATA]
        require('./services/cron.exchange.get_tickers')(config, out, models, redis, exchange);
        require('./services/cron.kraken.hourly_coin_prices_cache')(config, out, models, redis, exchange);
        require('./services/cron.coin.price.update.for.period')();
        require('./services/cron.user.balance.update.for.period')();
        require('./services/cron.fund.balance.update.for.period')();
        require('./services/cron.calculate.daily.aum')();
        // [DO THINGS]
        require('./services/cron.watch_notifications')(config, redis, notifications, funds);
        require('./services/cron.notification.push')(notifications);
        require('./services/cron.cancelNotExecutedAfter10DaysDeposits')(models, notifications);
        // require('./services/cron.deposit.recurring.execute')();
        // require('./services/cron.referral.update.stats')(referral);
        log.info('* *  * * * *                                    ');
        log.info('┬ ┬  ┬ ┬ ┬ ┬                                    ');
        log.info('│ │  │ │ │ │                                    ');
        log.info('│ │  │ │ │ └ day of week (0 - 7) (0 or 7 is Sun)');
        log.info('│ │  │ │ └── month (1 - 12)                     ');
        log.info('│ │  │ └──── day of month (1 - 31)              ');
        log.info('│ │  └────── hour (0 - 23)                      ');
        log.info('│ └────────── minute (0 - 59)                    ');
        log.info('└──────────── second (0 - 59, OPTIONAL)          ');
    });
