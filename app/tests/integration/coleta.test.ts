import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const URL_TESTE = process.env.DATABASE_URL_TEST;
const DBMATE_DISPONIVEL = spawnSync('dbmate', ['--version'], { encoding: 'utf8' }).status === 0;

if (!URL_TESTE) {
  console.warn('[coleta] DATABASE_URL_TEST não definida: teste de integração pulado.');
} else if (!DBMATE_DISPONIVEL) {
  console.warn('[coleta] dbmate não encontrado no PATH: teste de integração pulado.');
}

const deveRodar = Boolean(URL_TESTE) && DBMATE_DISPONIVEL;
const MIGRATIONS_DIR = path.resolve(process.cwd(), '..', 'db', 'migrations');

const ANA = 'ana@teste.local';
const BRUNO = 'bruno@teste.local';
const CARLA = 'carla@teste.local';
const ADMIN = 'admin@teste.local';

describe.skipIf(!deveRodar)('coleta (integração)', () => {
  const urlOriginal = process.env.DATABASE_URL;
  let listarN4: typeof import('@/server/coleta').listarN4;
  let listarLinhas: typeof import('@/server/coleta').listarLinhas;
  let gravarPrevisao: typeof import('@/server/coleta').gravarPrevisao;
  let query: typeof import('@/server/db').query;
  let encerrarPool: typeof import('@/server/db').encerrarPool;

  let n4Um: number;
  let n4Dois: number;
  let linhaA: number;
  let linhaB: number;
  let linhaDois: number;

  const dadosPara = (linha: number, versaoEsperada: number, previsaoCentavos: number) => ({
    linha_id: linha,
    versao_esperada: versaoEsperada,
    previsao_futura: previsaoCentavos,
    classificacao: 'COMPROMISSO' as const,
    confianca: 'ALTA' as const,
    justificativa: 'Justificativa de teste',
    proxima_acao: null,
    responsavel: null,
  });

  const estadoLinha = async (linha: number) =>
    (
      await query<{ versao: number; previsao_futura: string; atualizado_por: string }>(
        'select versao, previsao_futura::text, atualizado_por from forecast_input where linha_id = $1',
        [linha],
      )
    )[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;

    ({ query, encerrarPool } = await import('@/server/db'));
    ({ listarN4, listarLinhas, gravarPrevisao } = await import('@/server/coleta'));

    await query('drop schema public cascade; create schema public;');

    const migracao = spawnSync(
      'dbmate',
      ['--migrations-dir', MIGRATIONS_DIR, '--no-dump-schema', 'up'],
      { encoding: 'utf8', env: { ...process.env, DATABASE_URL: URL_TESTE } },
    );
    if (migracao.status !== 0) {
      throw new Error(`dbmate up falhou: ${migracao.stderr}`);
    }

    await query(`
      insert into dim_n4 (nome) values ('N4 Um'), ('N4 Dois');
      insert into dim_projeto (codigo, nome_curto) values ('PRJ-A', 'Projeto A'), ('PRJ-B', 'Projeto B');
      insert into import_run (arquivo, sha256, linhas_lidas, status)
        values ('sintetico.xlsx', repeat('b', 64), 4, 'ok');
    `);

    const id = async (sql: string) => (await query<{ id: number }>(sql))[0]?.id ?? 0;
    n4Um = await id("select n4_id as id from dim_n4 where nome = 'N4 Um'");
    n4Dois = await id("select n4_id as id from dim_n4 where nome = 'N4 Dois'");
    const projetoA = await id("select projeto_id as id from dim_projeto where codigo = 'PRJ-A'");
    const projetoB = await id("select projeto_id as id from dim_projeto where codigo = 'PRJ-B'");
    const importRun = (await query<{ id: string }>('select id from import_run'))[0]?.id;

    await query(
      `insert into forecast_linha (n4_id, projeto_id) values ($1, $2), ($1, $3), ($4, $2)`,
      [n4Um, projetoA, projetoB, n4Dois],
    );
    linhaA = await id(`select linha_id as id from forecast_linha where n4_id = ${n4Um} and projeto_id = ${projetoA}`);
    linhaB = await id(`select linha_id as id from forecast_linha where n4_id = ${n4Um} and projeto_id = ${projetoB}`);
    linhaDois = await id(`select linha_id as id from forecast_linha where n4_id = ${n4Dois} and projeto_id = ${projetoA}`);

    const colunas =
      'row_key, import_run_id, cen2, cenario, n4_id, n5, centro_custo, projeto_id, projeto_texto, finalidade, fornecedor, conta, grupo, mes, valor, origem, lancamento, oc_rc, dt_contabilizacao, linha_planilha';
    const lancamento = (
      chave: number,
      cen2: 'ORC_BG' | 'REAL',
      n4: number,
      projeto: number,
      projetoTexto: string,
      valor: string,
    ) => [
      String(chave).padStart(40, '0'),
      importRun,
      cen2,
      cen2 === 'ORC_BG' ? 'Orçamento' : 'Realizado',
      n4,
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
      chave,
    ];
    const lancamentos = [
      lancamento(1, 'ORC_BG', n4Um, projetoA, 'Projeto A', '100.00'),
      lancamento(2, 'REAL', n4Um, projetoA, 'Projeto A', '40.00'),
      lancamento(3, 'ORC_BG', n4Um, projetoB, 'Projeto B', '50.00'),
      lancamento(4, 'ORC_BG', n4Dois, projetoA, 'Projeto A', '30.00'),
    ];
    for (const valores of lancamentos) {
      const marcadores = valores.map((_, i) => `$${i + 1}`).join(', ');
      await query(`insert into fato_lancamento (${colunas}) values (${marcadores})`, valores);
    }

    await query(
      `insert into usuario (email, nome, papel) values
         ($1, 'Ana', 'responsavel'), ($2, 'Bruno', 'responsavel'),
         ($3, 'Carla', 'responsavel'), ($4, 'Admin', 'admin')`,
      [ANA, BRUNO, CARLA, ADMIN],
    );
    await query(
      `insert into usuario_acesso (email, n4_id, projeto_id) values ($1, $2, $3), ($4, $5, null)`,
      [ANA, n4Um, (await id(`select projeto_id as id from forecast_linha where linha_id = ${linhaA}`)), BRUNO, n4Dois],
    );
  });

  afterAll(async () => {
    await encerrarPool();
    if (urlOriginal === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = urlOriginal;
    }
  });

  it('listarN4 respeita permissões e ordena por ORC+BG desc', async () => {
    const n4s = await listarN4(ANA);

    expect(n4s.map((n) => n.n4)).toEqual(['N4 Um', 'N4 Dois']);
    expect(n4s[0]).toMatchObject({
      total_linhas: 2,
      linhas_completas: 0,
      linhas_editaveis: 1,
      pendencias: 1,
      orc_bg: 150,
      saldo_atual: 110,
    });
    expect(n4s[1]).toMatchObject({ linhas_editaveis: 0, pendencias: 0 });
  });

  it('listarLinhas marca pode_editar só nas linhas permitidas e versao 0 sem input', async () => {
    const linhas = await listarLinhas(n4Um, ANA);
    const porId = new Map(linhas.map((l) => [l.linha_id, l]));

    expect(porId.get(linhaA)).toMatchObject({ pode_editar: true, versao: 0, input_completo: false });
    expect(porId.get(linhaB)).toMatchObject({ pode_editar: false, versao: 0 });
    expect(linhas[0]?.saldo_atual).toBeGreaterThanOrEqual(linhas[1]?.saldo_atual ?? 0);
  });

  it('primeira gravação cria com versão 1 e atualizado_por = e-mail da sessão', async () => {
    const resultado = await gravarPrevisao({ email: ANA }, dadosPara(linhaA, 0, 1000));

    expect(resultado).toMatchObject({ ok: true, versao: 1 });
    expect(await estadoLinha(linhaA)).toMatchObject({
      versao: 1,
      previsao_futura: '10.00',
      atualizado_por: ANA,
    });
  });

  it('segunda gravação com versão 1 grava e retorna 2', async () => {
    const resultado = await gravarPrevisao({ email: ANA }, dadosPara(linhaA, 1, 2550));

    expect(resultado).toMatchObject({ ok: true, versao: 2 });
    expect((await estadoLinha(linhaA))?.previsao_futura).toBe('25.50');
  });

  it('gravação com versão antiga retorna conflito e não altera a linha', async () => {
    const antes = await estadoLinha(linhaA);
    const resultado = await gravarPrevisao({ email: ANA }, dadosPara(linhaA, 1, 9999));

    expect(resultado).toMatchObject({
      ok: false,
      conflito: true,
      mensagem: 'Outra pessoa salvou esta linha antes. Os dados foram recarregados.',
    });
    expect(await estadoLinha(linhaA)).toEqual(antes);
  });

  it('usuário sem permissão não grava e não cria linha', async () => {
    const resultado = await gravarPrevisao({ email: CARLA }, dadosPara(linhaA, 2, 100));

    expect(resultado).toEqual({ ok: false, mensagem: 'Sem permissão para esta linha' });
    expect((await estadoLinha(linhaA))?.versao).toBe(2);
    expect(await estadoLinha(linhaDois)).toBeUndefined();
  });

  it('responsável de projeto só grava naquele projeto', async () => {
    const outroProjeto = await gravarPrevisao({ email: ANA }, dadosPara(linhaB, 0, 100));
    expect(outroProjeto).toEqual({ ok: false, mensagem: 'Sem permissão para esta linha' });
    expect(await estadoLinha(linhaB)).toBeUndefined();
  });

  it('responsável de N4 inteiro grava em qualquer projeto daquele N4', async () => {
    const resultado = await gravarPrevisao({ email: BRUNO }, dadosPara(linhaDois, 0, 500));
    expect(resultado).toMatchObject({ ok: true, versao: 1 });

    const deOutroN4 = await gravarPrevisao({ email: BRUNO }, dadosPara(linhaA, 2, 100));
    expect(deOutroN4).toEqual({ ok: false, mensagem: 'Sem permissão para esta linha' });
  });

  it('admin grava qualquer linha ativa', async () => {
    const resultado = await gravarPrevisao({ email: ADMIN }, dadosPara(linhaB, 0, 700));
    expect(resultado).toMatchObject({ ok: true, versao: 1 });
    expect((await estadoLinha(linhaB))?.atualizado_por).toBe(ADMIN);
  });

  it('listarLinhas reflete a versão gravada e input_completo calculado pela view', async () => {
    const linhas = await listarLinhas(n4Um, ANA);
    const linhaGravada = linhas.find((l) => l.linha_id === linhaA);

    expect(linhaGravada).toMatchObject({ versao: 2, input_completo: false, pode_editar: true });
    expect(linhaGravada?.previsao_futura).toBe(25.5);
  });
});
