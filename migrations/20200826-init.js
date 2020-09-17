'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface
                .createTable('payments', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.INTEGER,
                        autoIncrement: true
                    },
                    paymentIntentId: {
                        type: Sequelize.STRING,
                        unique: true
                    },
                    recipient: {
                        type: Sequelize.STRING
                    },
                    value: {
                        type: Sequelize.STRING
                    },
                    gasPrice: {
                        type: Sequelize.STRING
                    },
                    createEvent: {
                        type: Sequelize.TEXT
                    },
                    cancelEvent: {
                        type: Sequelize.TEXT
                    },
                    succeededEvent: {
                        type: Sequelize.TEXT
                    },
                    transactionHash: {
                        type: Sequelize.STRING
                    },
                    state: {
                        type: Sequelize.ENUM,
                        values: [
                            'created',
                            'cancelled',
                            'refunded',
                            'errored',
                            'succeeded'
                        ],
                        defaultValue: 'created'
                    },
                    errors: {
                        type: Sequelize.TEXT
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }
                })
        ]);
    }
};
