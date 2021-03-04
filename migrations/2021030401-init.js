'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all(
            [
                queryInterface.changeColumn(
                    'orgids',
                    'orgidType',
                    {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    }
                ),
                queryInterface.changeColumn(
                    'orgids',
                    'directory',
                    {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    }
                ),
                queryInterface.changeColumn(
                    'orgids',
                    'name',
                    {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    }
                ),
                queryInterface.changeColumn(
                    'orgids',
                    'country',
                    {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    }
                ),
                queryInterface.changeColumn(
                    'orgids',
                    'jsonContent',
                    {
                        charset: 'utf8mb4',
                        collate: 'utf8mb4_unicode_ci'
                    }
                ),
            ]
        );
    }
};
