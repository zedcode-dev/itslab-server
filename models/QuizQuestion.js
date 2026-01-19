// ============================================================================
// MODELS/QUIZQUESTION.JS - Quiz Question Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
    const QuizQuestion = sequelize.define('QuizQuestion', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        quiz_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'quizzes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        question_text: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        points: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        order_index: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    }, {
        tableName: 'quiz_questions',
        timestamps: true,
        underscored: true,
    });

    return QuizQuestion;
};
