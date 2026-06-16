import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../../.env') });

async function runMigration(file: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(file, 'utf8');

  console.log(`Running migration: ${file}`);
  try {
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const file = process.argv[2] ?? join(__dirname, '../src/database/migrations/001_hito1_foundation.sql');
runMigration(file);
