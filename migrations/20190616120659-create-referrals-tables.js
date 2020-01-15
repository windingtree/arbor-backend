'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface
                .createTable('ref_codes', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.INTEGER,
                        autoIncrement: true
                    },
                    code: {
                        unique: true,
                        type: Sequelize.STRING,
                    },
                    userId: {
                        type: Sequelize.STRING,
                        unique: true,
                        allowNull: false,
                        references: {
                            model: 'users', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                        // onDelete: 'SET NULL',
                    },
                    invitedByUserId: {
                        type: Sequelize.STRING,
                        allowNull: true,
                        references: {
                            model: 'users', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                        // onDelete: 'SET NULL',
                    },
                    createdAt: {
                        type: Sequelize.DATE
                    },
                    updatedAt: {
                        type: Sequelize.DATE
                    }
                }),
            queryInterface
                .createTable('ref_payments', {
                    id: {
                        primaryKey: true,
                        type: Sequelize.INTEGER,
                        autoIncrement: true
                    },
                    userId: {
                        type: Sequelize.STRING,
                        allowNull: false,
                        unique: true,
                        references: {
                            model: 'users', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                        // onDelete: 'SET NULL',
                    },
                    invitedUserId: {
                        type: Sequelize.STRING,
                        allowNull: false,
                        references: {
                            model: 'users', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                        // onDelete: 'SET NULL',
                    },
                    rewardTxId: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: 'transactions', // name of Target model
                            key: 'id', // key in Target model that we're referencing
                        },
                        onUpdate: 'CASCADE',
                        // onDelete: 'SET NULL',
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
            queryInterface.dropTable('ref_codes'),
            queryInterface.dropTable('ref_payments')
        ]);
    }
};
