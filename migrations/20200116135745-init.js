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
                            type: Sequelize.STRING(66)
                        },
                        owner: {
                            type: Sequelize.STRING(42)
                        },
                        subsidiaries: {
                            type: Sequelize.TEXT
                        },
                        parent: {
                            type: Sequelize.TEXT
                        },
                        ////// off chain
                        orgidType: {
                            type: Sequelize.STRING(42)
                        },
                        directory: {
                            type: Sequelize.ENUM('legalEntity', 'hotel', 'airline', 'ota', 'insurance', 'unknown')
                        },
                        director: {
                            type: Sequelize.STRING(42),
                            defaultValue: '0x0000000000000000000000000000000000000000'
                        },
                        state: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        directorConfirmed: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
                        },
                        name: {
                            type: Sequelize.STRING(42)
                        },
                        logo: {
                            type: Sequelize.BLOB
                        },
                        country: {
                            type: Sequelize.STRING(42)
                        },
                        proofsQty: {
                            type: Sequelize.TINYINT
                        },
                        isLifProved: {
                            type: Sequelize.BOOLEAN,
                            defaultValue: false
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

                        orgJsonHash: {
                            type: Sequelize.STRING(66)
                        },
                        orgJsonUri: {
                            type: Sequelize.STRING(1024)
                        },
                        jsonContent: {
                            type: Sequelize.TEXT
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

    down: (queryInterface/*, Sequelize*/) => {
        return Promise.all([
            queryInterface.dropTable('orgids'),
            queryInterface.dropTable('stats'),    // old one
            queryInterface.dropTable('managers'), // old one
            queryInterface.dropTable('sections')  // old one
        ]);
    }
};
