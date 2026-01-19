// ============================================================================
// MIDDLEWARE/MAINTENANCE.JS - Maintenance Mode Check
// ============================================================================

const { SystemSetting } = require('../models');
const { errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Middleware to check if site is in maintenance mode
 * Admins are allowed to bypass maintenance mode
 */
const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Find maintenance_mode setting
        const setting = await SystemSetting.findOne({ where: { key: 'maintenance_mode' } });

        const isMaintenance = setting ? (setting.value === true || setting.value === 'true') : false;

        if (isMaintenance) {
            // Allow admins to bypass
            if (req.user && req.user.role === 'admin') {
                return next();
            }

            // Also check for maintenance_message
            const messageSetting = await SystemSetting.findOne({ where: { key: 'maintenance_message' } });
            const message = messageSetting ? messageSetting.value : 'Site is currently under maintenance. Please try again later.';

            return errorResponse(res, 503, message);
        }

        next();
    } catch (error) {
        logger.error('Error checking maintenance mode:', error);
        next(); // Proceed anyway to avoid locking the site on DB error
    }
};

module.exports = checkMaintenanceMode;
