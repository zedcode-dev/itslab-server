// ============================================================================
// CONTROLLERS/QUIZ_CONTROLLER.JS - Quiz Management
// ============================================================================

const { Quiz, QuizQuestion, QuizOption, QuizAttempt, Lesson, Progress, Enrollment, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * @desc Get quiz for a lesson (Student view - no correct answers)
 */
exports.getQuizForStudent = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const userId = req.user?.id;

        const quiz = await Quiz.findOne({
            where: { lesson_id: lessonId },
            include: [
                {
                    model: QuizQuestion,
                    as: 'questions',
                    include: [
                        {
                            model: QuizOption,
                            as: 'options',
                            attributes: ['id', 'option_text'], // Hide is_correct
                        },
                    ],
                },
            ],
            order: [[{ model: QuizQuestion, as: 'questions' }, 'order_index', 'ASC']],
        });

        if (!quiz) {
            return errorResponse(res, 404, 'Quiz not found');
        }

        // Get last passing attempt for this user
        let lastPassingAttempt = null;
        if (userId) {
            lastPassingAttempt = await QuizAttempt.findOne({
                where: { quiz_id: quiz.id, user_id: userId, passed: true },
                order: [['created_at', 'DESC']],
                attributes: ['id', 'score', 'passed', 'created_at']
            });
        }

        return successResponse(res, 200, 'Quiz retrieved successfully', {
            ...quiz.toJSON(),
            lastPassingAttempt
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Submit quiz attempt
 */
exports.submitQuiz = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const { answers } = req.body; // { questionId: selectedOptionId }
        const userId = req.user.id;

        const quiz = await Quiz.findOne({
            where: { lesson_id: lessonId },
            include: [
                {
                    model: QuizQuestion,
                    as: 'questions',
                    include: [{ model: QuizOption, as: 'options' }],
                },
            ],
        });

        if (!quiz) return errorResponse(res, 404, 'Quiz not found');

        // SECURITY FIX: Validate enrollment before processing quiz
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{ model: require('../models').Section, as: 'section' }]
        });

        if (!lesson) return errorResponse(res, 404, 'Lesson not found');

        const enrollment = await Enrollment.findOne({
            where: { user_id: userId, course_id: lesson.section.course_id, payment_status: 'completed' }
        });

        if (!enrollment) {
            return errorResponse(res, 403, 'You must be enrolled in this course to submit this quiz');
        }

        let totalPoints = 0;
        let earnedPoints = 0;

        quiz.questions.forEach((question) => {
            totalPoints += question.points;
            const selectedOptionId = answers[question.id];
            const correctOption = question.options.find(o => o.is_correct);

            if (selectedOptionId === correctOption?.id) {
                earnedPoints += question.points;
            }
        });

        const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = scorePercentage >= quiz.passing_score;

        // Record attempt
        const attempt = await QuizAttempt.create({
            quiz_id: quiz.id,
            user_id: userId,
            score: scorePercentage,
            passed,
            answers,
        });

        // Update progress if passed (reuse enrollment from earlier validation)
        if (passed) {
            // enrollment already verified above
            const [progress, created] = await Progress.findOrCreate({
                where: {
                    enrollment_id: enrollment.id,
                    lesson_id: lessonId,
                },
                defaults: {
                    completed: true,
                    completed_at: new Date(),
                }
            });

            if (!created && !progress.completed) {
                await progress.update({
                    completed: true,
                    completed_at: new Date(),
                });
            }

            // Update enrollment last accessed
            await enrollment.update({ last_accessed_at: new Date() });

            // Use the built-in calculateProgress method for consistency
            await enrollment.calculateProgress();
        }

        return successResponse(res, 200, 'Quiz submitted successfully', {
            attempt,
            score: scorePercentage,
            passed,
            passingScale: quiz.passing_score
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get/Create quiz for instructor (Full data)
 */
exports.getQuizForInstructor = async (req, res, next) => {
    try {
        const { lessonId } = req.params;

        let quiz = await Quiz.findOne({
            where: { lesson_id: lessonId },
            include: [
                {
                    model: QuizQuestion,
                    as: 'questions',
                    include: [{ model: QuizOption, as: 'options' }],
                },
            ],
            order: [[{ model: QuizQuestion, as: 'questions' }, 'order_index', 'ASC']],
        });

        if (!quiz) {
            // Create empty quiz if none exists
            quiz = await Quiz.create({ lesson_id: lessonId });
            quiz = await Quiz.findByPk(quiz.id, { include: ['questions'] });
        }

        return successResponse(res, 200, 'Quiz retrieved successfully', quiz);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Save quiz questions (Full replacement for simplicity)
 */
exports.saveQuiz = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const { passing_score, questions } = req.body;

        let quiz = await Quiz.findOne({ where: { lesson_id: lessonId } });
        if (!quiz) {
            quiz = await Quiz.create({ lesson_id: lessonId, passing_score });
        } else {
            await quiz.update({ passing_score });
        }

        // Delete existing questions and options to replace
        const oldQuestions = await QuizQuestion.findAll({ where: { quiz_id: quiz.id } });
        for (const q of oldQuestions) {
            await QuizOption.destroy({ where: { question_id: q.id } });
            await q.destroy();
        }

        // Create new ones
        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i];
            const newQuestion = await QuizQuestion.create({
                quiz_id: quiz.id,
                question_text: qData.question_text,
                points: qData.points || 1,
                order_index: i,
            });

            for (const oData of qData.options) {
                await QuizOption.create({
                    question_id: newQuestion.id,
                    option_text: oData.option_text,
                    is_correct: oData.is_correct,
                });
            }
        }

        return successResponse(res, 200, 'Quiz saved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * @desc Get all student results for a specific quiz
 */
exports.getQuizResults = async (req, res, next) => {
    try {
        const { lessonId } = req.params;

        const quiz = await Quiz.findOne({ where: { lesson_id: lessonId } });
        if (!quiz) return errorResponse(res, 404, 'Quiz not found');

        const attempts = await QuizAttempt.findAll({
            where: { quiz_id: quiz.id },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email'],
                },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, 200, 'Quiz results retrieved successfully', {
            quiz: {
                id: quiz.id,
                passingScore: quiz.passing_score,
            },
            attempts: attempts.map(a => ({
                id: a.id,
                student: a.user,
                score: a.score,
                passed: a.passed,
                submittedAt: a.created_at,
            })),
        });
    } catch (error) {
        next(error);
    }
};
