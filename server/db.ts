import { readFile, readdir } from 'node:fs/promises';

// PostgreSQL adapters return heterogeneous rows; command inputs use Zod and public DTOs are explicitly constructed.
// eslint-disable-next-line typescript/no-explicit-any
export type Row = Record<string, any>;
export interface Sql {
  query<T extends Row = Row>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function connectDatabase(options: {
  localPath?: string;
  connectionString?: string;
}): Promise<Database> {
  if (options.connectionString) {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: options.connectionString,
      max: 5,
    });
    return {
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({
            query: (sql, params) => client.query(sql, params),
            exec: (sql) => client.query(sql),
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (options.localPath === undefined)
    throw new Error(
      'Database configuration is required. Local mode must be explicit.',
    );
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(options.localPath || undefined);
  await pg.waitReady;
  return {
    query: (sql, params) => pg.query(sql, params),
    exec: (sql) => pg.exec(sql),
    transaction: (fn) => pg.transaction((tx) => fn(tx)),
    close: () => pg.close(),
  };
}

export async function migrate(db: Database) {
  await db.query(
    'CREATE TABLE IF NOT EXISTS build_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const name = file.replace(/\.sql$/, '');
    const applied = await db.query(
      'SELECT name FROM build_migrations WHERE name=$1',
      [name],
    );
    if (applied.rows.length) continue;
    const source = await readFile(new URL(file, directory), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(source);
      await tx.query('INSERT INTO build_migrations(name) VALUES($1)', [name]);
    });
  }
}

export async function one<T extends Row = Row>(
  db: Sql,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return (await db.query<T>(sql, params)).rows[0];
}
