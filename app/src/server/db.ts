import 'server-only';
import { Pool } from 'pg';
import { exigirDatabaseUrl } from './ambiente';

let pool: Pool | null = null;

// Em produção na Vercel, DATABASE_URL deve ser a connection string COM pooling do Neon
// (host com "-pooler") e incluir sslmode=require. Cada instância serverless usa até 5
// conexões; o pooler do Neon absorve o restante. Localmente nada muda.
export function obterPool(): Pool {
  if (pool) {
    return pool;
  }
  pool = new Pool({
    connectionString: exigirDatabaseUrl(process.env),
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
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
