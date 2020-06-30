'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.changeColumn('orgids', 'directory', {
                type: Sequelize.STRING(42),
                defaultValue: 'unknown'
            })
        ]);
    },

    down: (queryInterface/*, Sequelize*/) => {
        return Promise.all([]);
    }
};
