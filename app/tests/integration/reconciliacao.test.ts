import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const URL_TESTE = process.env.DATABASE_URL_TEST;
const DBMATE_DISPONIVEL = spawnSync('dbmate', ['--version'], { encoding: 'utf8' }).status === 0;

if (!URL_TESTE) {
  console.warn('[reconciliacao] DATABASE_URL_TEST não definida: teste de integração pulado.');
} else if (!DBMATE_DISPONIVEL) {
  console.warn('[reconciliacao] dbmate não encontrado no PATH: teste de integração pulado.');
}

const deveRodar = Boolean(URL_TESTE) && DBMATE_DISPONIVEL;
const MIGRATIONS_DIR = path.resolve(process.cwd(), '..', 'db', 'migrations');

describe.skipIf(!deveRodar)('getReconciliacao (integração)', () => {
  const urlOriginal = process.env.DATABASE_URL;
  let getReconciliacao: typeof import('@/server/reconciliacao').getReconciliacao;
  let query: typeof import('@/server/db').query;
  let encerrarPool: typeof import('@/server/db').encerrarPool;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;

    ({ query, encerrarPool } = await import('@/server/db'));
    ({ getReconciliacao } = await import('@/server/reconciliacao'));

    await query('drop schema public cascade; create schema public;');

    const migracao = spawnSync(
      'dbmate',
      ['--migrations-dir', MIGRATIONS_DIR, '--no-dump-schema', 'up'],
      {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: URL_TESTE },
      },
    );
    if (migracao.status !== 0) {
      throw new Error(`dbmate up falhou: ${migracao.stderr}`);
    }

    await query(`
      insert into dim_n4 (nome) values ('N4 Teste');
      insert into dim_projeto (codigo, nome_curto) values ('PRJ-A', 'Projeto A'), ('PRJ-B', 'Projeto B');
      insert into import_run (arquivo, sha256, linhas_lidas, status)
        values ('teste.xlsx', repeat('a', 64), 3, 'ok');
    `);

    const n4Id = (await query<{ n4_id: number }>('select n4_id from dim_n4'))[0]?.n4_id;
    const projetoA = (
      await query<{ projeto_id: number }>("select projeto_id from dim_projeto where codigo = 'PRJ-A'")
    )[0]?.projeto_id;
    const projetoB = (
      await query<{ projeto_id: number }>("select projeto_id from dim_projeto where codigo = 'PRJ-B'")
    )[0]?.projeto_id;
    const importRunId = (await query<{ id: string }>('select id from import_run'))[0]?.id;

    const linha = (
      chave: string,
      cen2: 'ORC_BG' | 'REAL',
      projeto: number | undefined,
      projetoTexto: string,
      valor: string,
      linhaPlanilha: number,
    ) => [
      chave.padStart(40, '0'),
      importRunId,
      cen2,
      cen2 === 'ORC_BG' ? 'Orçamento' : 'Realizado',
      n4Id,
      'N5 Teste',
      'CC-1',
      projeto,
      projetoTexto,
      'Finalidade',
      'Fornecedor',
      '600001',
      'Grupo',
      1,
      valor,
      'Origem',
      'Lançamento',
      'OC-1',
      '2026-01-31',
      linhaPlanilha,
    ];

    const linhas = [
      linha('1', 'ORC_BG', projetoA, 'Projeto A', '100.00', 2),
      linha('2', 'REAL', projetoA, 'Projeto A', '40.00', 3),
      linha('3', 'REAL', projetoB, 'Projeto B', '10.00', 4),
    ];

    const colunas =
      'row_key, import_run_id, cen2, cenario, n4_id, n5, centro_custo, projeto_id, projeto_texto, finalidade, fornecedor, conta, grupo, mes, valor, origem, lancamento, oc_rc, dt_contabilizacao, linha_planilha';
    for (const valores of linhas) {
      const marcadores = valores.map((_, i) => `$${i + 1}`).join(', ');
      await query(`insert into fato_lancamento (${colunas}) values (${marcadores})`, valores);
    }
  });

  afterAll(async () => {
    await encerrarPool();
    if (urlOriginal === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = urlOriginal;
    }
  });

  it('devolve a reconciliação com valores numéricos', async () => {
    const resultado = await getReconciliacao();

    expect(resultado).toEqual({
      orcBg: 100,
      realizado: 50,
      saldo: 50,
      utilizacao: 0.5,
      realSemOrcamento: 10,
      linhasRealSemOrcamento: 1,
    });
  });
});
