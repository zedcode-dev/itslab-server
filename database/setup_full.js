// ============================================================================
// DATABASE/SETUP_FULL.JS - Force Sync and Seed
// ============================================================================

require('dotenv').config();
const { sequelize } = require('../config/database');
const seedDatabase = require('./seed'); // Import the seed function we already wrote
const logger = require('../utils/logger');

async function setup() {
    try {
        logger.info('Starting full database setup...');

        // Force sync: This drops tables if they exist and creates them based on Models
        // This bypasses the flawed migration script for now
        await sequelize.sync({ force: true });
        logger.info('✓ Database synchronized (tables created)');

        // Run the seed function
        // We need to modify seed.js slightly to not be a standalone script if we import it, 
        // or we can just require it if it exports a function.
        // checking seed.js, it exports `seedDatabase` and runs it if main.

        // Since we are running this script, require('./seed') would run it if it wasn't wrapped?
        // Actually our seed.js has: if (require.main === module) { seedDatabase(); }
        // So requiring it here is safe.

        const seed = require('./seed');
        await seed();

        logger.info('✓ Full setup completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Setup failed:', error);
        process.exit(1);
    }
}

setup();
