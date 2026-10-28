import 'server-only';
import { Pool } from 'pg';

let pool: Pool | null = null;

function obterPool(): Pool {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida. Configure-a em app/.env.local.');
  }
  pool = new Pool({ connectionString });
  return pool;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const resultado = await obterPool().query(sql, params);
  return resultado.rows as T[];
}

export async function encerrarPool(): Promise<void> {
  if (pool) {
    const atual = pool;
    pool = null;
    await atual.end();
  }
}
