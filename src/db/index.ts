import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function resolveSqlHost(): string | undefined {
  const configured = process.env.SQL_HOST?.trim();
  if (!configured) return undefined;

  // For Cloud Run Unix socket paths, verify the PostgreSQL socket actually exists
  if (configured.startsWith('/')) {
    if (fs.existsSync(path.join(configured, '.s.PGSQL.5432'))) {
      return configured;
    }
    return undefined;
  }

  return configured;
}

const resolvedHost = resolveSqlHost();

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: resolvedHost,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 4000,
    });

    global._postgresPool.on('error', () => {
      // Handled by availability probe / fallback store
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });

export const isDatabaseConfigured = () =>
  Boolean(
    resolvedHost &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD &&
      process.env.SQL_DB_NAME
  );

let cachedSqlAvailable: boolean | null = null;
let lastCheckedAt = 0;
const SQL_PROBE_TTL_MS = 60_000;

export function markSqlUnavailable() {
  cachedSqlAvailable = false;
  lastCheckedAt = Date.now();
}

export async function isSqlAvailable(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const now = Date.now();
  if (cachedSqlAvailable !== null && now - lastCheckedAt < SQL_PROBE_TTL_MS) {
    return cachedSqlAvailable;
  }

  try {
    await pool.query('SELECT 1');
    cachedSqlAvailable = true;
  } catch {
    cachedSqlAvailable = false;
  }
  lastCheckedAt = now;
  return cachedSqlAvailable;
}
