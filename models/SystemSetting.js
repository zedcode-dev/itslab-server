module.exports = (sequelize, DataTypes) => {
    const SystemSetting = sequelize.define('SystemSetting', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        value: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        }
    }, {
        tableName: 'system_settings',
        timestamps: true,
    });

    return SystemSetting;
};
