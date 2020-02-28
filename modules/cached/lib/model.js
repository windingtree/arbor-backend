const Sequelize = require('sequelize');
module.exports = function (sequelize) {
    const jsonGetterSetter = (field) => ({
        type: Sequelize.TEXT,
        get() {
            if (this.getDataValue(field)) {
                return JSON.parse(this.getDataValue(field));
            }
            return null;
        },
        set(val) {
            if (typeof val === 'object') this.setDataValue(field, JSON.stringify(val));
            else this.setDataValue(field, null);
        },
    });
    // TABLE 1 of 2: orgids
    const orgid = sequelize.define('orgid',
        {
            orgid: {
                primaryKey: true,
                type: Sequelize.STRING(42)
            },
            owner: {
                type: Sequelize.STRING(42)
            },
            subsidiaries: jsonGetterSetter('subsidiaries'),
            parent: jsonGetterSetter('parent'),
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
                type: Sequelize.STRING(1024)
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
            jsonContent: jsonGetterSetter('jsonContent'),
            jsonCheckedAt: {
                type: Sequelize.DATE
            },
            jsonUpdatedAt: {
                type: Sequelize.DATE
            },
        },
        {
            timestamps: true,
        }
    );

    orgid.upsert = (values, condition) => (
        orgid.findOne({ where: condition })
            .then((obj) => {
                if (obj) {
                    return obj.update(values);
                }
                return orgid.create(values);
            })
    );

    // TABLE 2 of 2: stats
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

    return [orgid, stats];
};
