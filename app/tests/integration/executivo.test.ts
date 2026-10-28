import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const URL_TESTE = process.env.DATABASE_URL_TEST;
const DBMATE_DISPONIVEL = spawnSync('dbmate', ['--version'], { encoding: 'utf8' }).status === 0;

if (!URL_TESTE) {
  console.warn('[executivo] DATABASE_URL_TEST não definida: teste de integração pulado.');
} else if (!DBMATE_DISPONIVEL) {
  console.warn('[executivo] dbmate não encontrado no PATH: teste de integração pulado.');
}

const deveRodar = Boolean(URL_TESTE) && DBMATE_DISPONIVEL;
const MIGRATIONS_DIR = path.resolve(process.cwd(), '..', 'db', 'migrations');

interface Cenario {
  n4: string;
  projeto: string;
  orc: number;
  real: number;
  // Quando ausente, a linha fica sem entrada de forecast (não completa).
  entrada?: {
    previsao: number;
    classificacao: string;
    confianca: string;
    justificativa: string;
    proximaAcao: string;
  };
}

// Cenário com linhas em todas as categorias:
// OPORTUNIDADE: A/P1 (40), A/P4 (30), B/P3 (60)
// PRESSAO:      A/P2 (oportunidade -20, completa), A/P3 (saldo -30, sem entrada)
// A_VALIDAR:    B/P1 (sem entrada, saldo positivo)
// COMPROMISSO:  B/P2 (oportunidade 0)
const CENARIOS: Cenario[] = [
  {
    n4: 'N4 Alfa',
    projeto: 'PRJ-1',
    orc: 100,
    real: 40,
    entrada: { previsao: 20, classificacao: 'ECONOMIA', confianca: 'ALTA', justificativa: 'Economia de frete', proximaAcao: 'Renegociar' },
  },
  {
    n4: 'N4 Alfa',
    projeto: 'PRJ-2',
    orc: 100,
    real: 60,
    entrada: { previsao: 60, classificacao: 'COMPROMISSO', confianca: 'MEDIA', justificativa: 'Gasto previsto', proximaAcao: 'Acompanhar' },
  },
  { n4: 'N4 Alfa', projeto: 'PRJ-3', orc: 50, real: 80 },
  {
    n4: 'N4 Alfa',
    projeto: 'PRJ-4',
    orc: 80,
    real: 30,
    entrada: { previsao: 20, classificacao: 'POSTERGACAO', confianca: 'MEDIA', justificativa: 'Compra adiada', proximaAcao: 'Revisar em junho' },
  },
  { n4: 'N4 Beta', projeto: 'PRJ-1', orc: 100, real: 10 },
  {
    n4: 'N4 Beta',
    projeto: 'PRJ-2',
    orc: 100,
    real: 50,
    entrada: { previsao: 50, classificacao: 'COMPROMISSO', confianca: 'ALTA', justificativa: 'Contrato vigente', proximaAcao: 'Monitorar' },
  },
  {
    n4: 'N4 Beta',
    projeto: 'PRJ-3',
    orc: 100,
    real: 30,
    entrada: { previsao: 10, classificacao: 'ECONOMIA', confianca: 'BAIXA', justificativa: 'Troca de fornecedor', proximaAcao: 'Cotar' },
  },
];

describe.skipIf(!deveRodar)('executivo (integração)', () => {
  const urlOriginal = process.env.DATABASE_URL;
  let mod: typeof import('@/server/executivo');
  let query: typeof import('@/server/db').query;
  let encerrarPool: typeof import('@/server/db').encerrarPool;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;

    ({ query, encerrarPool } = await import('@/server/db'));
    mod = await import('@/server/executivo');

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
      insert into dim_n4 (nome) values ('N4 Alfa'), ('N4 Beta');
      insert into dim_projeto (codigo, nome_curto) values
        ('PRJ-1', 'Projeto 1'), ('PRJ-2', 'Projeto 2'), ('PRJ-3', 'Projeto 3'), ('PRJ-4', 'Projeto 4');
      insert into import_run (arquivo, sha256, linhas_lidas, status)
        values ('executivo.xlsx', repeat('b', 64), 14, 'ok');
    `);

    const importRunId = (await query<{ id: string }>('select id from import_run'))[0]?.id;

    let contador = 0;
    for (const cenario of CENARIOS) {
      const ids = await query<{ n4_id: number; projeto_id: number; linha_id: number }>(
        `
        insert into forecast_linha (n4_id, projeto_id, responsavel)
        select n.n4_id, p.projeto_id, 'Ana'
        from dim_n4 n, dim_projeto p
        where n.nome = $1 and p.codigo = $2
        returning n4_id, projeto_id, linha_id
        `,
        [cenario.n4, cenario.projeto],
      );
      const { n4_id: n4Id, projeto_id: projetoId, linha_id: linhaId } = ids[0]!;

      const lancamento = async (cen2: 'ORC_BG' | 'REAL', valor: number) => {
        contador += 1;
        await query(
          `insert into fato_lancamento (row_key, import_run_id, cen2, cenario, n4_id, n5, centro_custo,
             projeto_id, projeto_texto, finalidade, fornecedor, conta, grupo, mes, valor, origem,
             lancamento, oc_rc, dt_contabilizacao, linha_planilha)
           values ($1, $2, $3, $4, $5, 'N5 Teste', 'CC-1', $6, $7, 'Finalidade', 'Fornecedor',
             '600001', 'Grupo', 1, $8, 'Origem', 'Lançamento', 'OC-1', '2026-01-31', $9)`,
          [
            String(contador).padStart(40, '0'),
            importRunId,
            cen2,
            cen2 === 'ORC_BG' ? 'Orçamento' : 'Realizado',
            n4Id,
            projetoId,
            cenario.projeto,
            valor.toFixed(2),
            contador,
          ],
        );
      };

      await lancamento('ORC_BG', cenario.orc);
      await lancamento('REAL', cenario.real);

      if (cenario.entrada) {
        const e = cenario.entrada;
        await query(
          `insert into forecast_input (linha_id, previsao_futura, classificacao, justificativa, confianca, proxima_acao, responsavel)
           values ($1, $2, $3, $4, $5, $6, 'Ana')`,
          [linhaId, e.previsao.toFixed(2), e.classificacao, e.justificativa, e.confianca, e.proximaAcao],
        );
      }
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

  it('obterResumoGeral bate com as somas das views', async () => {
    const resumo = await mod.obterResumoGeral();

    const [esperado] = await query<{
      orc_bg: string;
      realizado: string;
      forecast: string;
      oportunidade: string;
      pressoes: string;
      linhas: string;
      com_input: string;
    }>(`
      select
        (select orc_bg from vw_reconciliacao) as orc_bg,
        (select realizado from vw_reconciliacao) as realizado,
        (select sum(forecast_fechamento) from vw_forecast) as forecast,
        (select sum(oportunidade_ajustada) from vw_forecast where categoria = 'OPORTUNIDADE') as oportunidade,
        (select sum(oportunidade_ajustada) from vw_forecast where categoria = 'PRESSAO') as pressoes,
        (select count(*) from vw_forecast) as linhas,
        (select count(*) from vw_forecast where input_completo) as com_input
    `);

    expect(resumo.orcBg).toBe(Number(esperado?.orc_bg));
    expect(resumo.realizado).toBe(Number(esperado?.realizado));
    expect(resumo.forecastFechamento).toBe(Number(esperado?.forecast));
    expect(resumo.oportunidadeAjustada).toBe(Number(esperado?.oportunidade));
    expect(resumo.pressoes).toBe(Number(esperado?.pressoes));
    expect(resumo.linhas).toBe(Number(esperado?.linhas));
    expect(resumo.linhasComInput).toBe(Number(esperado?.com_input));
  });

  it('obterResumoGeral usa os valores fixados do cenário', async () => {
    const resumo = await mod.obterResumoGeral();

    expect(resumo.orcBg).toBe(630);
    expect(resumo.realizado).toBe(300);
    expect(resumo.saldo).toBe(330);
    expect(resumo.utilizacao).toBeCloseTo(0.4762, 4);
    expect(resumo.forecastFechamento).toBe(550);
    expect(resumo.oportunidadeAjustada).toBe(130);
    expect(resumo.linhas).toBe(7);
    expect(resumo.linhasComInput).toBe(5);
  });

  it('listarResumoN4 traz uma linha por N4 ordenada por orçamento desc', async () => {
    const linhas = await mod.listarResumoN4();

    expect(linhas.map((l) => l.n4)).toEqual(['N4 Alfa', 'N4 Beta']);
    expect(linhas[0]?.orcBg).toBe(330);
    expect(linhas[1]?.orcBg).toBe(300);
    expect(linhas[0]?.linhas).toBe(4);
    expect(linhas[0]?.linhasComInput).toBe(3);
    expect(linhas[0]?.pctComInput).toBeCloseTo(0.75, 4);
  });

  it('listarPorCategoria soma saldo e oportunidade por categoria', async () => {
    const categorias = await mod.listarPorCategoria();
    const mapa = new Map(categorias.map((c) => [c.categoria, c]));

    expect(mapa.get('OPORTUNIDADE')?.quantidade).toBe(3);
    expect(mapa.get('OPORTUNIDADE')?.oportunidadeAjustada).toBe(130);
    expect(mapa.get('PRESSAO')?.quantidade).toBe(2);
    expect(mapa.get('A_VALIDAR')?.quantidade).toBe(1);
    expect(mapa.get('COMPROMISSO')?.quantidade).toBe(1);

    const totalQuantidade = categorias.reduce((soma, c) => soma + c.quantidade, 0);
    expect(totalQuantidade).toBe(7);
  });

  it('listarMaioresOportunidades vem ordenada desc e só com categoria OPORTUNIDADE', async () => {
    const lista = await mod.listarMaioresOportunidades();

    expect(lista.map((o) => o.oportunidadeAjustada)).toEqual([60, 40, 30]);
    expect(lista.map((o) => `${o.n4}/${o.projeto}`)).toEqual([
      'N4 Beta/Projeto 3',
      'N4 Alfa/Projeto 1',
      'N4 Alfa/Projeto 4',
    ]);
  });

  it('listarMaioresOportunidades respeita o limite', async () => {
    const lista = await mod.listarMaioresOportunidades(2);

    expect(lista).toHaveLength(2);
    expect(lista[0]?.oportunidadeAjustada).toBe(60);
  });

  it('listarMaioresPressoes vem ordenada asc (pior primeiro) e respeita o limite', async () => {
    const lista = await mod.listarMaioresPressoes();
    expect(lista.map((p) => p.oportunidadeAjustada)).toEqual([-30, -20]);
    expect(lista[0]?.projeto).toBe('Projeto 3');

    const limitada = await mod.listarMaioresPressoes(1);
    expect(limitada).toHaveLength(1);
  });

  it('rejeita limites inválidos', async () => {
    await expect(mod.listarMaioresOportunidades(0)).rejects.toThrow('Limite inválido');
    await expect(mod.listarMaioresPressoes(1.5)).rejects.toThrow('Limite inválido');
  });
});
