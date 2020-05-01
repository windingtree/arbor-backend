// Web3 WS Connection Guard

const Web3 = require('web3');
const log = require('log4js').getLogger(__filename.split('\\').pop().split('/').pop());
log.level = 'debug';

class ConnectionGuard {
    
    constructor (
        url,
        onDisconnect = () => {},
        onConnect = () => {},
        onBlock = () => {}
    ) {
        // Configuration
        this.url = url;
        this.onDisconnect = onDisconnect;
        this.onConnect = onConnect;
        this.onBlock = onBlock;

        // Web3
        this.web3 = new Web3();
        this.provider;

        // Service properties
        this.isReconnecting = false;
        this.connectRequired = true;
        this.connectionWatcherInterval;
        this.connectionTimeout;

        // Start
        this.requestsWatcher();
    }

    get isConnected () {
        return !this.isReconnecting &&
            !this.connectRequired &&
            this.provider.connection.readyState === this.provider.connection.OPEN;
    }

    async getCurrentBlockNumber () {
        let counter = 0;
        let blockNumber;

        if (!this.isConnected) {
            throw new Error('Unable to fetch blockNumber: no connection');
        }

        do {
            if (counter === 10) {
                throw new Error('Unable to fetch blockNumber');
            }
            blockNumber = await this.web3.eth.getBlockNumber();
            counter++;
        } while (typeof blockNumber !== 'number')

        return blockNumber;
    };

    requestsWatcher () {
        log.debug('Connection requests watcher started');
        setInterval(() => {
            if (this.connectRequired && !this.isReconnecting) {
                log.debug('Disconnected');

                this.connectionTimeout = setTimeout(() => {
                    this.isReconnecting = false;
                    this.requestConnection('connection timeout');
                }, 5000);

                this.connectRequired = false;
                this.onDisconnect();
                this.connect();
            }
        }, 1000);
    }

    connectionWatcher () {
        log.debug('Connection watcher started');
        clearInterval(this.connectionWatcherInterval);
        this.connectionWatcherInterval = setInterval(async () => {
            try {
                const connection = this.provider.connection;
                const allowedStates = [connection.CONNECTING, connection.OPEN];
                
                if (!allowedStates.includes(connection.readyState)) {
                    this.requestConnection('connection not found');
                } else {
                    const blockNumber = await this.getCurrentBlockNumber();
                    this.onBlock(blockNumber);
                }       
            } catch (error) {
                this.requestConnection(error.message);
            }
        }, 5000);
    }

    requestConnection (reason) {
        log.debug('Reconnection requested with reason:', reason);

        if (!this.isReconnecting) {
            this.connectRequired = true;
        }
    }

    connect () {
        log.debug('Connecting to ethereum node...');
        
        this.isReconnecting = true;
        this.provider = new Web3.providers.WebsocketProvider(this.url, {
            timeout: 9999
        });

        this.provider.on('error', e => {
            const message = e.message || 'cannot connect';
            log.error('Provider error:', message);
            this.requestConnection(message);
        });

        this.provider.on('end', e => {
            const message = e.reason || (e.toString ? e.toString() : e)
            log.debug('Connection closed:', message);
            this.requestConnection(message);
        });

        this.provider.on('connect', () => {
            clearTimeout(this.connectionTimeout);
            log.debug('Connected');
            this.isReconnecting = false;
            this.onConnect();
            this.connectionWatcher();
        });

        this.web3.setProvider(this.provider);
    }
}

module.exports = (url, onDisconnect, onConnect, onBlock) => {
    const cg = new ConnectionGuard(url, onDisconnect, onConnect, onBlock);
    log.info('Connection Guard Initialized');
    return cg.web3;
};
