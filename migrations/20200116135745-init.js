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
            // 1.
            queryInterface
                .createTable('orgids', {
                    orgid: {
                        primaryKey: true,
                        type: Sequelize.STRING(42)
                    },
                    entrypoint: {
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
                    keccak256: {
                        type: Sequelize.STRING(64)
                    },
                    json_link: {
                        type: Sequelize.STRING(1024)
                    },
                    json: {
                        type: Sequelize.BLOB
                    },
                    json_updateAt: {
                        type: Sequelize.DATE
                    },
                    trust_clues_site_data: {
                        type: Sequelize.STRING(512)
                    },
                    trust_clues_site_valid: {
                        type: Sequelize.BOOLEAN
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }

                }),
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
                }),
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
