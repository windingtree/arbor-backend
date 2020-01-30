'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface
                .createTable(
                    'orgids',
                    {
                        ////// on chain
                        orgid: {
                            primaryKey: true,
                            type: Sequelize.STRING(42)
                        },
                        owner: {
                            type: Sequelize.STRING(42),
                        },
                        subsidiaries: {
                            type: Sequelize.BLOB
                        },
                        parent: {
                            type: Sequelize.STRING(1024)
                        },
                        ////// off chain
                        orgidType: {
                            type: Sequelize.STRING(42),
                        },
                        directory: {
                            type: Sequelize.ENUM('legalEntity', 'hotel', 'airline', 'ota', 'unknown'),
                        },
                        name: {
                            type: Sequelize.STRING(42),
                        },
                        avatar: {
                            type: Sequelize.BLOB
                        },
                        country: {
                            type: Sequelize.STRING(42),
                        },
                        proofsQty: {
                            type: Sequelize.TINYINT
                        },
                        isWebsiteProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isSslProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isSocialFBProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isSocialTWProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isSocialIGProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isSocialLNProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        isJsonValid: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },

                        jsonHash: {
                            type: Sequelize.STRING(66)
                        },
                        jsonUri: {
                            type: Sequelize.STRING(1024)
                        },
                        jsonContent: {
                            type: Sequelize.BLOB
                        },
                        jsonCheckedAt: {
                            type: Sequelize.DATE
                        },
                        jsonUpdatedAt: {
                            type: Sequelize.DATE
                        },

                        createdAt: {
                            type: Sequelize.DATE
                        },
                        updatedAt: {
                            type: Sequelize.DATE
                        },
                    }
            ),
            // 4.
            queryInterface
                .createTable('stats', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.INTEGER,
                        autoIncrement: true
                    },
                    name: {
                        unique: true,
                        type: Sequelize.STRING(128)
                    },
                    value: {
                        type: Sequelize.STRING(256)
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    },
                })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.dropTable('orgids'),
            queryInterface.dropTable('stats'),
            queryInterface.dropTable('managers'), // old one
            queryInterface.dropTable('sections')  // old one
        ]);
    }
};
