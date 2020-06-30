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
                            type: Sequelize.STRING(42),
                            defaultValue: 'unknown'
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
                            type: Sequelize.STRING(1024)
                        },
                        logo: {
                            type: Sequelize.STRING(1024)
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
                }),
            queryInterface
                .createTable('drafts', {
                    profileId: {
                        primaryKey: true,
                        type: Sequelize.STRING(9),
                        defaultValue: () => Math.random().toString(36).substr(2, 9)
                    },
                    password: {
                        type: Sequelize.STRING(9),
                        defaultValue: () => Math.random().toString(36).substr(2, 9)
                    },
                    json: {
                        type: Sequelize.TEXT,
                        get() {
                            if (this.getDataValue('json')) {
                                return JSON.parse(this.getDataValue('json'));
                            }
                            return null;
                        },
                        set(value) {
                            if (typeof value === 'object') {
                                this.setDataValue('json', JSON.stringify(value));
                            } else {
                                this.setDataValue('json', null);
                            }
                        }
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }
                })
        ]);
    },

    down: (queryInterface/*, Sequelize*/) => {
        return Promise.all([]);
    }
};
