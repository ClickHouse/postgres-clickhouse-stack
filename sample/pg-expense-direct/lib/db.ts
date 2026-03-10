import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const SOURCE_SCHEMA = process.env.SOURCE_SCHEMA || 'public';
export const DESTINATION_SCHEMA = process.env.DESTINATION_SCHEMA || 'expense_ch';

// Runtime-togglable schema for SELECT queries.
// null = source (PostgreSQL), non-null = destination (ClickHouse via FDW).
let activeSchema: string | null = null;

export function getActiveSchema() {
  return activeSchema || SOURCE_SCHEMA;
}

export function getBackend() {
  return activeSchema ? 'ClickHouse (via FDW)' : 'PostgreSQL';
}

export function useSource() {
  activeSchema = null;
}

export function useDestination() {
  activeSchema = DESTINATION_SCHEMA;
}

export async function query(text: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const schema = activeSchema || SOURCE_SCHEMA;
    await client.query('SET search_path TO ' + schema + ', public');
    return await client.query(text, params);
  } finally {
    await client.query('SET search_path TO ' + SOURCE_SCHEMA);
    client.release();
  }
}

export default pool;
