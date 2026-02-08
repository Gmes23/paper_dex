import { Client } from 'pg';

export function createPgClient() {
  return new Client({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'gm',
    database: process.env.PGDATABASE ?? 'fakeprices',
    password: process.env.PGPASSWORD,
  });
}
