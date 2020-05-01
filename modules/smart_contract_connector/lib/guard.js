// Web3 WS Connection Guard

const Web3 = require('web3');
const log = require('log4js').getLogger('connection_guard');
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
        this.web3ApiTimeout = 10 * 1000;
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
            this.web3.currentProvider.connected;
    }

    async getCurrentBlockNumber () {
        let counter = 0;
        let blockNumber;

        do {
            if (!this.isConnected) {
                throw new Error(
                    'Unable to fetch blockNumber: no connection'
                );
            }

            if (counter === 10) {
                throw new Error(
                    'Unable to fetch blockNumber: retries limit has been reached'
                );
            }

            blockNumber = await this.web3.eth.getBlockNumber();
            counter++;
        } while (typeof blockNumber !== 'number');

        return blockNumber;
    };

    requestConnection (reason) {
        log.debug('Reconnection requested with reason:', reason);

        if (!this.isReconnecting) {
            this.connectRequired = true;
        }
    }

    requestsWatcher () {
        log.debug('Connection requests watcher started');

        setInterval(() => {
            if (this.connectRequired && !this.isReconnecting) {
                log.debug('Going to connect in 5 sec');

                this.connectRequired = false;
                this.isReconnecting = true;
                this.onDisconnect();

                // Connect with delay 5 sec
                setTimeout(() => {
                    this.connectionTimeout = setTimeout(() => {
                        this.isReconnecting = false;
                        this.requestConnection('connection timeout');
                    }, this.web3ApiTimeout / 2);
                    this.connect();
                }, this.web3ApiTimeout / 2);
            }
        }, this.web3ApiTimeout / 10);
    }

    connectionWatcher () {
        log.debug('Connection watcher started');

        clearInterval(this.connectionWatcherInterval);
        this.connectionWatcherInterval = setInterval(async () => {
            try {
                const connection = this.provider.connection;
                const allowedStates = [
                    connection.CONNECTING,
                    connection.OPEN
                ];
                
                if (!allowedStates.includes(connection.readyState)) {
                    this.requestConnection('disconnection detected');
                } else if (connection.readyState === connection.CONNECTING) {
                    this.provider.on('connect', async () => {
                        try {
                            const blockNumber = await this.getCurrentBlockNumber();
                            this.onBlock(blockNumber);
                        } catch (error) {
                            this.requestConnection(error.message);
                        }
                    });
                } else {
                    const blockNumber = await this.getCurrentBlockNumber();
                    this.onBlock(blockNumber);
                }
            } catch (error) {
                this.requestConnection(error.message);
            }
        }, this.web3ApiTimeout / 2);
    }

    connect () {
        log.debug('Connecting...');
        
        this.provider = new Web3.providers.WebsocketProvider(this.url, {
            timeout: this.web3ApiTimeout * 2
        });
        this.web3 = new Web3(this.provider);

        this.provider.on('error', e => {
            if (!this.isReconnecting) {
                const message = e.message || 'cannot connect';
                log.error('Connection error:', message);
                this.requestConnection(message);
            }
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
            this.onConnect(this.web3)
            this.connectionWatcher();
        });
    }
}

module.exports = (
    url,
    onDisconnect,
    onConnect,
    onBlock
) => new ConnectionGuard(url, onDisconnect, onConnect, onBlock);
