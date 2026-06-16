'use strict';

/**
 * Crea 5 usuarios con rol SECTOR_DIAGNOSTICS para diagnóstico sectorial.
 * Ejecutar: node scripts/create-sector-users.js
 *
 * Prerequisito: ejecutar antes la migración 054_sector_diagnostics_role.sql
 * El hash de contraseña lo genera pgcrypto (crypt + gen_salt) para ser
 * compatible con sp_validate_login.
 */

const { Pool } = require('pg');
const crypto   = require('crypto');

const pool = new Pool({
  host: '127.0.0.1', port: 5432,
  user: 'postgres', password: 'Andres',
  database: 'Estrategia_dev',
});

const ORG_ID = process.env.DEMO_ORG_ID || 'cc25bd52-3b85-40ac-b226-cd98bc1a69e1';

const USERS = [
  { email: 'usuario1@sendoagil.com', name: 'Usuario 1' },
  { email: 'usuario2@sendoagil.com', name: 'Usuario 2' },
  { email: 'usuario3@sendoagil.com', name: 'Usuario 3' },
  { email: 'usuario4@sendoagil.com', name: 'Usuario 4' },
  { email: 'usuario5@sendoagil.com', name: 'Usuario 5' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of USERS) {
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [u.email],
      );
      if (existing.rows.length > 0) {
        console.log(`⚠  ${u.email} ya existe, actualizando contraseña y rol...`);
        await client.query(
          `UPDATE users
              SET password_hash    = crypt('123', gen_salt('bf', 12)),
                  role             = 'SECTOR_DIAGNOSTICS',
                  is_active        = TRUE,
                  email_verified   = TRUE,
                  deleted_at       = NULL,
                  updated_at       = NOW()
            WHERE email = $1`,
          [u.email],
        );
      } else {
        const userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO users
             (id, organization_id, email, name, password_hash, role, is_active, email_verified)
           VALUES ($1, $2, $3, $4, crypt('123', gen_salt('bf', 12)), 'SECTOR_DIAGNOSTICS', TRUE, TRUE)`,
          [userId, ORG_ID, u.email, u.name],
        );
        console.log(`✅ ${u.email} creado (id: ${userId})`);
      }
    }

    await client.query('COMMIT');
    console.log('\nListo. 5 usuarios con rol SECTOR_DIAGNOSTICS creados.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rollback ejecutado:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
