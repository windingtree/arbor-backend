'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => Promise.all([
        queryInterface
            .createTable(
                'trustedPersons',
                {
                    ipfs: {
                        type: Sequelize.STRING
                    },
                    orgId: {
                        type: Sequelize.STRING
                    },
                    name: {
                        type: Sequelize.STRING
                    },
                    type: {
                        type: Sequelize.STRING
                    },
                    value: {
                        type: Sequelize.STRING
                    },
                    expire: {
                        type: Sequelize.DATE
                    }
                }
            )
    ])
};
