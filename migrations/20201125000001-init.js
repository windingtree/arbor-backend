'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.changeColumn('orgids', 'directory', {
                type: Sequelize.TEXT,
                defaultValue: 'unknown'
            })
        ]);
    },

    down: (queryInterface/*, Sequelize*/) => {
        return Promise.all([]);
    }
};
