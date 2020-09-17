'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface
                .createTable('estimations', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.INTEGER,
                        autoIncrement: true
                    },
                    recipient: {
                        type: Sequelize.STRING
                    },
                    method: {
                        type: Sequelize.STRING
                    },
                    args: {
                        type: Sequelize.TEXT
                    },
                    amount: {
                        type: Sequelize.STRING
                    },
                    currency: {
                        type: Sequelize.STRING
                    },
                    value: {
                        type: Sequelize.STRING
                    },
                    gasPrice: {
                        type: Sequelize.STRING
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
