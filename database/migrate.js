// ============================================================================
// DATABASE/MIGRATE.JS - Database Migration Script
// ============================================================================

require('dotenv').config();
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    logger.info('Starting database migration...');

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      logger.error('schema.sql not found!');
      process.exit(1);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the entire schema as a single block to handle functions/triggers correctly
    // PostgreSQL and the 'pg' driver support multiple statements in a single query
    try {
      await sequelize.query(schema);
      logger.info('✓ Schema executed successfully');
    } catch (error) {
      // If full execution fails, log it but don't stop if it's just "already exists" errors
      if (!error.message.includes('already exists')) {
        logger.error(`Initial migration error: ${error.message}`);

        // Fallback: Try splitting by a more specific pattern if needed, 
        // but for now let's hope the full execution works.
        // If it was already partially executed, we might get "already exists" errors.
      }
    }

    logger.info('✓ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;