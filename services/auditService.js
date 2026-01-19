// ============================================================================
// SERVICES/AUDIT_SERVICE.JS - Centralized Audit Logging
// ============================================================================

const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Log an action to the AuditLog table
 * @param {Object} params - Logging parameters
 * @param {string} params.userId - ID of the user performing the action
 * @param {string} params.action - Description of the action (e.g., 'COURSE_DELETED')
 * @param {string} params.entityType - Type of entity affected (e.g., 'Course')
 * @param {string} params.entityId - ID of the entity affected
 * @param {Object} [params.oldValues] - State before the change
 * @param {Object} [params.newValues] - State after the change
 * @param {Object} [params.req] - Express request object to extract IP and UA
 */
const logAction = async ({
    userId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    req
}) => {
    try {
        await AuditLog.create({
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues,
            new_values: newValues,
            ip_address: req?.ip || 'unknown',
            user_agent: req?.get('User-Agent') || 'unknown'
        });
    } catch (error) {
        // We log the error but don't throw to avoid breaking the main operation
        logger.error(`Failed to create audit log for action ${action}:`, error);
    }
};

module.exports = {
    logAction
};
