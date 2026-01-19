// ============================================================================
// MODELS/QUIZOPTION.JS - Quiz Option Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
    const QuizOption = sequelize.define('QuizOption', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        question_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'quiz_questions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        option_text: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        is_correct: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    }, {
        tableName: 'quiz_options',
        timestamps: true,
        underscored: true,
    });

    return QuizOption;
};
