require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function setup() {
  try {
    console.log('Creating tables...');

    // Rooms table
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id VARCHAR(255) PRIMARY KEY,
        host_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        player_names JSONB NOT NULL,
        scores JSONB NOT NULL,
        log JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'waiting',
        winner VARCHAR(255)
      );
    `;
    console.log('Created rooms table');

    // Game History table
    await sql`
      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        winner VARCHAR(255),
        rounds INTEGER,
        players JSONB NOT NULL
      );
    `;
    console.log('Created game_history table');

    // Active Games table (one per device/user)
    await sql`
      CREATE TABLE IF NOT EXISTS active_games (
        device_id VARCHAR(255) PRIMARY KEY,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT false,
        player_names JSONB,
        scores JSONB,
        log JSONB
      );
    `;
    console.log('Created active_games table');

    // User Settings table
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        device_id VARCHAR(255) PRIMARY KEY,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_player_names JSONB
      );
    `;
    console.log('Created user_settings table');

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    process.exit(0);
  }
}

setup();
