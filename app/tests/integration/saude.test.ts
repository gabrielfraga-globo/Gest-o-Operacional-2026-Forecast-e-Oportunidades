import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const URL_TESTE = process.env.DATABASE_URL_TEST;

afterEach(async () => {
  const { encerrarPool } = await import('@/server/db');
  await encerrarPool();
  vi.resetModules();
});

describe('GET /api/saude (integração)', () => {
  it.skipIf(!URL_TESTE)('responde 200 {ok:true} com banco disponível', async () => {
    process.env.DATABASE_URL = URL_TESTE;
    const { GET } = await import('@/app/api/saude/route');
    const resposta = await GET();
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });

  it('responde 503 {ok:false} sem detalhes quando o banco está fora', async () => {
    process.env.DATABASE_URL = 'postgres://usuario:senha@127.0.0.1:1/inexistente?sslmode=disable';
    const { GET } = await import('@/app/api/saude/route');
    const resposta = await GET();
    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ ok: false });
  });
});
