const { SystemSetting } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

/**
 * System Settings Controller
 * Handles fetching and updating global site settings.
 */

// Get all public settings
exports.getPublicSettings = async (req, res, next) => {
    try {
        const settings = await SystemSetting.findAll({
            where: {
                key: ['maintenance_mode', 'instructor_registration_enabled', 'site_name', 'site_description']
            }
        });

        const formattedSettings = {};
        settings.forEach(s => {
            formattedSettings[s.key] = s.value;
        });

        return successResponse(res, 200, 'Public settings retrieved', {
            settings: formattedSettings
        });
    } catch (error) {
        next(error);
    }
};

// Get all settings (Admin only)
exports.getAllSettings = async (req, res, next) => {
    try {
        const settings = await SystemSetting.findAll();
        return successResponse(res, 200, 'All settings retrieved', { settings });
    } catch (error) {
        next(error);
    }
};

// Update or Create settings
exports.updateSettings = async (req, res, next) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return errorResponse(res, 400, 'Invalid settings data');
        }

        const updates = [];
        for (const [key, value] of Object.entries(settings)) {
            updates.push(
                SystemSetting.upsert({
                    key,
                    value
                })
            );
        }

        await Promise.all(updates);
        return successResponse(res, 200, 'Settings updated successfully');
    } catch (error) {
        next(error);
    }
};

// Initialize default settings if not exists
exports.initializeDefaultSettings = async () => {
    try {
        const defaults = [
            { key: 'maintenance_mode', value: false, description: 'Block all users except admins' },
            { key: 'maintenance_message', value: 'We are currently performing maintenance. Please check back later.', description: 'Message shown during maintenance' },
            { key: 'instructor_registration_enabled', value: true, description: 'Allow new instructors to register' },
            { key: 'site_name', value: 'ITSLab', description: 'Platform display name' },
            { key: 'site_description', value: 'Expert-led technology courses', description: 'Meta description for SEO' },
            { key: 'allow_manual_payment', value: true, description: 'Enable Vodafone Cash & InstaPay' }
        ];

        for (const item of defaults) {
            const exists = await SystemSetting.findOne({ where: { key: item.key } });
            if (!exists) {
                await SystemSetting.create(item);
            }
        }
    } catch (error) {
        console.error('Failed to initialize default settings:', error);
    }
};
