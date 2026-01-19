// // ============================================================================
// // MODELS/REVIEW.JS - Review Model
// // ============================================================================

// module.exports = (sequelize, DataTypes) => {
//   const Review = sequelize.define('Review', {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     user_id: {
//       type: DataTypes.UUID,
//       allowNull: false,
//     },
//     course_id: {
//       type: DataTypes.UUID,
//       allowNull: false,
//     },
//     rating: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//       validate: {
//         min: 1,
//         max: 5,
//       },
//     },
//     review_text: {
//       type: DataTypes.TEXT,
//     },
//     is_verified_purchase: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: false,
//     },
//   }, {
//     tableName: 'reviews',
//     indexes: [
//       { fields: ['user_id'] },
//       { fields: ['course_id'] },
//       { fields: ['user_id', 'course_id'], unique: true },
//       { fields: ['rating'] },
//     ],
//   });

//   return Review;
// };

// ============================================================================
// MODELS/REVIEW.JS - (V2) FIXED WITH HOOKS FOR AUTO RATING UPDATE
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define('Review', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    review_text: {
      type: DataTypes.TEXT,
    },
    is_verified_purchase: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'reviews',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['course_id'] },
      { fields: ['user_id', 'course_id'], unique: true },
      { fields: ['rating'] },
    ],
    hooks: {
      // FIX: Update course rating after review created
      afterCreate: async (review) => {
        const { Course } = sequelize.models;
        const course = await Course.findByPk(review.course_id);
        if (course) {
          await course.updateAverageRating();
        }
      },
      // FIX: Update course rating after review updated
      afterUpdate: async (review) => {
        if (review.changed('rating')) {
          const { Course } = sequelize.models;
          const course = await Course.findByPk(review.course_id);
          if (course) {
            await course.updateAverageRating();
          }
        }
      },
      // FIX: Update course rating after review deleted
      afterDestroy: async (review) => {
        const { Course } = sequelize.models;
        const course = await Course.findByPk(review.course_id);
        if (course) {
          await course.updateAverageRating();
        }
      },
    },
  });

  return Review;
};
