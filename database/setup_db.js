const { Client } = require('pg');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Connect to default 'postgres' db first
};

const client = new Client(config);

async function createDatabase() {
    try {
        await client.connect();

        // Check if database exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME || 'itslab'}'`);

        if (res.rowCount === 0) {
            console.log(`Database ${process.env.DB_NAME || 'itslab'} does not exist. Creating...`);
            await client.query(`CREATE DATABASE "${process.env.DB_NAME || 'itslab'}"`);
            console.log('Database created successfully.');
        } else {
            console.log('Database already exists.');
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
