'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            // 1.
            queryInterface
                .createTable('managers', {
                    address: {
                        primaryKey: true,
                        type: Sequelize.STRING(42),
                    },
                    org_id: {
                        unique: true,
                        type: Sequelize.STRING(42),
                    },
                    role: {
                        type: Sequelize.STRING(5),
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }
                }),
            // 2.
            queryInterface
                .createTable('sections', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.STRING(42)
                    },
                    name: {
                        type: Sequelize.STRING(256)
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }
                }),
            // 3.
            queryInterface
                .createTable('orgids', {
                    orgid: {
                        primaryKey: true,
                        type: Sequelize.STRING(42)
                    },
                    environment: {
                        type: Sequelize.STRING(42)
                    },
                    section: {
                        type: Sequelize.STRING(42),
                        references: {
                            model: 'sections', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                    },
                    owner: {
                        type: Sequelize.STRING(66),
                    },
                    orgJsonHash: {
                        type: Sequelize.STRING(66)
                    },
                    orgJsonUri: {
                        type: Sequelize.STRING(1024)
                    },
                    orgJsonContent: {
                        type: Sequelize.BLOB
                    },
                    dateCreated: {
                        type: Sequelize.DATE
                    },
                    dateUpdated: {
                        type: Sequelize.DATE
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    },
                    //name: {},
                    trust_clues_site_data: {type: Sequelize.STRING(512)}, //TODO make for <types>
                    trust_clues_site_valid: {type: Sequelize.BOOLEAN},

                }),
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
                    }
                })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.dropTable('managers'),
            queryInterface.dropTable('orgids'),
            queryInterface.dropTable('stats'),
            queryInterface.dropTable('sections')
        ]);
    }
};
