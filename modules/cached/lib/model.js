const Sequelize = require('sequelize');
module.exports = function (sequelize) {
    // TABLE 1 of 2: managers
    const manager = sequelize.define('manager',
        {
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
            }

        },
        {
            timestamps: true,
        }
    );
    // TABLE 2 of 4: orgids
    const orgid = sequelize.define('orgid',
        {
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
            //name: {},
            trust_clues_site_data: {type: Sequelize.STRING(512)}, //TODO make for <types>
            trust_clues_site_valid: {type: Sequelize.BOOLEAN},

        },
        {
            timestamps: true,
        }
    );
    // TABLE 3 of 4: stats
    const stats = sequelize.define('stats',
        {
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
            }

        },
        {
            timestamps: true,
        }
    );
    // TABLE 4 of 4: sections
    const section = sequelize.define('section',
        {
            id: {
                primaryKey: true,
                type: Sequelize.STRING(42)
            },
            name: {
                type: Sequelize.STRING(256)
            }

        },
        {
            timestamps: true,
        }
    );

    return [manager, orgid, stats, section];
};