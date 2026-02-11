import { Pool, PoolClient, type QueryResult, type QueryResultRow } from 'pg';

type QueryParam = string | number | boolean | null | object;

export type PgClientLike = {
  connect: () => Promise<void>;
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParam[]
  ) => Promise<QueryResult<R>>;
  end: () => Promise<void>;
};

declare global {
  var __pgPool: Pool | undefined;
}

function getPgPool() {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? 'gm',
      database: process.env.PGDATABASE ?? 'fakeprices',
      password: process.env.PGPASSWORD,
      ssl: process.env.NODE_ENV === 'production'  
        ? { rejectUnauthorized: false }
        : false,
      max: Number(process.env.PG_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
    });
  }
  return globalThis.__pgPool;
}

class WrappedPoolClient implements PgClientLike {
  private client: PoolClient | null = null;

  async connect() {
    if (this.client) return;
    this.client = await getPgPool().connect();
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: QueryParam[]
  ) {
    if (this.client) {
      return this.client.query<R>(text, params);
    }
    return getPgPool().query<R>(text, params);
  }

  async end() {
    if (!this.client) return;
    this.client.release();
    this.client = null;
  }
}

export function createPgClient(): PgClientLike {
  return new WrappedPoolClient();
}
