// ============================================================================
// MODELS/QUIZATTEMPT.JS - Quiz Attempt Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
    const QuizAttempt = sequelize.define('QuizAttempt', {
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
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        score: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        passed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        answers: {
            type: DataTypes.JSONB, // Stores: { questionId: selectedOptionId }
            allowNull: true,
        },
    }, {
        tableName: 'quiz_attempts',
        timestamps: true,
        underscored: true,
    });

    return QuizAttempt;
};
