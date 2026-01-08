import { Pool } from 'pg';
const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  options: process.env.DB_SCHEMA ? `-c search_path=${process.env.DB_SCHEMA},public` : undefined,
});

export default pool;
