import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';

export interface Queryable {
  query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const DB = Symbol('DB');

/**
 * DATABASE_URL=postgres://...  -> PostgreSQL thật (production)
 * DATABASE_URL=memory://       -> PGlite trong bộ nhớ (test)
 * không đặt                     -> PGlite lưu file tại ./data/pglite (dev)
 */
export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  if (url && /^postgres(ql)?:\/\//.test(url)) return createPgDb(url);
  let pg: PGlite;
  if (url === 'memory://') {
    pg = new PGlite();
  } else {
    const dir = process.env.PGLITE_DIR ?? join(process.cwd(), 'data', 'pglite');
    mkdirSync(dir, { recursive: true });
    pg = new PGlite(dir);
  }
  await pg.waitReady;
  return {
    query: async (text, params) => (await pg.query<any>(text, params)).rows,
    tx: (fn) =>
      pg.transaction((t) => fn({ query: async (text, params) => (await t.query<any>(text, params)).rows })),
    close: () => pg.close(),
  };
}

function createPgDb(url: string): Db {
  const pool = new Pool({ connectionString: url });
  return {
    query: async (text, params) => (await pool.query(text, params as any[])).rows,
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async (text, params) => (await client.query(text, params as any[])).rows });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function migrate(db: Db, dir = join(__dirname, '..', '..', 'migrations')): Promise<void> {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    await db.tx(async (q) => {
      for (const stmt of splitSql(sql)) await q.query(stmt);
      await q.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
    });
  }
}

/** Tách file migration thành từng câu lệnh (không hỗ trợ ; bên trong chuỗi/hàm). */
function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
