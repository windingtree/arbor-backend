const Sequelize = require('sequelize');

const jsonGetterSetter = field => (
    {
        type: Sequelize.TEXT,
        get() {
            const value = this.getDataValue(field);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        },
        set(val) {
            if (typeof val === 'object') this.setDataValue(field, JSON.stringify(val));
            else this.setDataValue(field, null);
        },
    }
);

module.exports = sequelize => {

    // Estimations
    const estimations = sequelize.define('estimations',
        {
            id: {
                primaryKey: true,
                type: Sequelize.INTEGER,
                autoIncrement: true
            },
            recipient: {
                type: Sequelize.STRING,
                is: /^0x[a-fA-F0-9]{40}$/
            },
            method: {
                type: Sequelize.STRING
            },
            args: jsonGetterSetter('args'),
            amount: {
                type: Sequelize.STRING
            },
            currency: {
                type: Sequelize.STRING
            },
            value: {
                type: Sequelize.STRING
            },
            gasPrice: {
                type: Sequelize.STRING
            }
        },
        {
            timestamps: true
        }
    );

    // Payments and their states
    const payments = sequelize.define('payments',
        {
            id: {
                primaryKey: true,
                type: Sequelize.INTEGER,
                autoIncrement: true
            },
            paymentIntentId: {
                type: Sequelize.STRING,
                unique: true
            },
            recipient: {
                type: Sequelize.STRING,
                is: /^0x[a-fA-F0-9]{40}$/
            },
            value: {
                type: Sequelize.STRING
            },
            gasPrice: {
                type: Sequelize.STRING
            },
            createEvent: jsonGetterSetter('createEvent'),
            cancelEvent: jsonGetterSetter('cancelEvent'),
            succeededEvent: jsonGetterSetter('succeededEvent'),
            transactionHash: {
                type: Sequelize.STRING
            },
            state: {
                type: Sequelize.ENUM,
                values: [
                    'created',
                    'cancelled',
                    'refunded',
                    'errored',
                    'succeeded'
                ],
                defaultValue: 'created'
            },
            errors: jsonGetterSetter('errors')
        },
        {
            timestamps: true
        }
    );

    return [payments, estimations];
};
