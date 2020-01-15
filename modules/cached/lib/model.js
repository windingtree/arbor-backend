const Sequelize = require('sequelize');
module.exports = function (sequelize) {
    // TABLE 1 of 2: ref_codes
    const refCode = sequelize.define('ref_code',
        {
            id: {
                primaryKey: true,
                type: Sequelize.INTEGER,
                autoIncrement: true
            },
            code: {
                unique: true,
                type: Sequelize.STRING,
            }
        },
        {
            timestamps: true,
        }
    );
    refCode.associate = function (models) {
        this.belongsTo(models.user, {
            foreignKey: {
                name: 'userId',
                allowNull: false,
                unique: true,
            }
        });
        this.belongsTo(models.user, {
            foreignKey: {
                name: 'invitedByUserId', // Referrer - A person who refers another person.
                allowNull: true
            }/*,
            onDelete: 'SET NULL'*/
        });
    };

    // TABLE 2 of 2: ref_payments
    const refPayment = sequelize.define('ref_payment',
        {
            id: {
                primaryKey: true,
                type: Sequelize.INTEGER,
                autoIncrement: true
            }
        },
        {
            timestamps: true,
        }
    );
    refPayment.associate = function (models) {
        this.belongsTo(models.user, {
            foreignKey: {
                name: 'invitedUserId', // Referee - A person who was referred by another person.
                allowNull: false,
            }
        });
        this.belongsTo(models.user, {
            foreignKey: {
                name: 'userId',
                allowNull: false,
                unique: true,
            }
        });
        this.belongsTo(models.transaction, {
            foreignKey: {
                name: 'rewardTxId',
                allowNull: true
            }
        });
    };
    refPayment.upsert = (values, condition) => (
        refPayment.findOne({ where: condition })
            .then((obj) => {
                if (obj) {
                    return obj.update(values);
                }
                console.log('values', values);
                return refPayment.create(values);
            })
    );

    return [refCode, refPayment];
};
