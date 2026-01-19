// ============================================================================
// MODELS/QUIZ.JS - Quiz Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
    const Quiz = sequelize.define('Quiz', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        lesson_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'lessons', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        passing_score: {
            type: DataTypes.INTEGER,
            defaultValue: 70, // Percentage
        },
    }, {
        tableName: 'quizzes',
        timestamps: true,
        underscored: true,
    });

    return Quiz;
};
