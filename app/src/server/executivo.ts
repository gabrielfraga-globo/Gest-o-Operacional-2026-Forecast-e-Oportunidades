import 'server-only';
import { query } from '@/server/db';

export interface ResumoGeral {
  orcBg: number;
  realizado: number;
  saldo: number;
  utilizacao: number | null;
  realSemOrcamento: number;
  forecastFechamento: number;
  oportunidadeAjustada: number;
  pressoes: number;
  linhas: number;
  linhasComInput: number;
}

export interface ResumoN4 {
  n4: string;
  orcBg: number;
  realizado: number;
  saldoLiquido: number;
  saldoBrutoPositivo: number;
  pressoes: number;
  forecastFechamento: number;
  oportunidadeAjustada: number;
  linhas: number;
  linhasComInput: number;
  pctComInput: number;
}

export interface ResumoCategoria {
  categoria: string;
  quantidade: number;
  saldoAtual: number;
  oportunidadeAjustada: number;
}

export interface MaiorOportunidade {
  n4: string;
  projeto: string;
  oportunidadeAjustada: number;
  justificativa: string | null;
  responsavel: string | null;
  confianca: string | null;
}

export interface MaiorPressao {
  n4: string;
  projeto: string;
  saldoAtual: number;
  oportunidadeAjustada: number;
  justificativa: string | null;
  responsavel: string | null;
}

// numeric/bigint chegam como string do pg. A conversão para number acontece
// só aqui, na borda, para exibição. Nenhuma regra de negócio é recalculada.
function paraNumero(valor: string | number | null): number {
  return valor === null ? 0 : Number(valor);
}

function paraNumeroOuNulo(valor: string | number | null): number | null {
  return valor === null ? null : Number(valor);
}

function validarLimite(limite: number): number {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error(`Limite inválido: ${limite}. Informe um inteiro maior que zero.`);
  }
  return limite;
}

interface LinhaReconciliacao {
  orc_bg: string | number | null;
  realizado: string | number | null;
  saldo: string | number | null;
  utilizacao: string | number | null;
  real_sem_orcamento: string | number | null;
}

interface LinhaSomaForecast {
  linhas: string | number;
  linhas_com_input: string | number;
  forecast_fechamento: string | number | null;
  oportunidade_ajustada: string | number | null;
  pressoes: string | number | null;
}

export async function obterResumoGeral(): Promise<ResumoGeral> {
  const [reconciliacao, forecast] = await Promise.all([
    query<LinhaReconciliacao>(
      'select orc_bg, realizado, saldo, utilizacao, real_sem_orcamento from vw_reconciliacao',
    ),
    query<LinhaSomaForecast>(`
      select
        count(*) as linhas,
        count(*) filter (where input_completo) as linhas_com_input,
        coalesce(sum(forecast_fechamento), 0) as forecast_fechamento,
        coalesce(sum(oportunidade_ajustada) filter (where categoria = 'OPORTUNIDADE'), 0) as oportunidade_ajustada,
        coalesce(sum(oportunidade_ajustada) filter (where categoria = 'PRESSAO'), 0) as pressoes
      from vw_forecast
    `),
  ]);

  const rec = reconciliacao[0];
  const fc = forecast[0];
  if (!rec || !fc) {
    throw new Error('vw_reconciliacao ou vw_forecast não retornou linhas.');
  }

  return {
    orcBg: paraNumero(rec.orc_bg),
    realizado: paraNumero(rec.realizado),
    saldo: paraNumero(rec.saldo),
    utilizacao: paraNumeroOuNulo(rec.utilizacao),
    realSemOrcamento: paraNumero(rec.real_sem_orcamento),
    forecastFechamento: paraNumero(fc.forecast_fechamento),
    oportunidadeAjustada: paraNumero(fc.oportunidade_ajustada),
    pressoes: paraNumero(fc.pressoes),
    linhas: paraNumero(fc.linhas),
    linhasComInput: paraNumero(fc.linhas_com_input),
  };
}

interface LinhaResumoN4 {
  n4: string;
  orc_bg: string | number | null;
  realizado: string | number | null;
  saldo_liquido: string | number | null;
  saldo_bruto_positivo: string | number | null;
  pressoes: string | number | null;
  forecast_fechamento: string | number | null;
  oportunidade_ajustada: string | number | null;
  linhas: string | number;
  linhas_com_input: string | number;
  pct_com_input: string | number | null;
}

export async function listarResumoN4(): Promise<ResumoN4[]> {
  const linhas = await query<LinhaResumoN4>(`
    select n4, orc_bg, realizado, saldo_liquido, saldo_bruto_positivo, pressoes,
           forecast_fechamento, oportunidade_ajustada, linhas, linhas_com_input, pct_com_input
    from vw_resumo_n4
    order by orc_bg desc
  `);

  return linhas.map((linha) => ({
    n4: linha.n4,
    orcBg: paraNumero(linha.orc_bg),
    realizado: paraNumero(linha.realizado),
    saldoLiquido: paraNumero(linha.saldo_liquido),
    saldoBrutoPositivo: paraNumero(linha.saldo_bruto_positivo),
    pressoes: paraNumero(linha.pressoes),
    forecastFechamento: paraNumero(linha.forecast_fechamento),
    oportunidadeAjustada: paraNumero(linha.oportunidade_ajustada),
    linhas: paraNumero(linha.linhas),
    linhasComInput: paraNumero(linha.linhas_com_input),
    pctComInput: paraNumero(linha.pct_com_input),
  }));
}

interface LinhaCategoria {
  categoria: string;
  quantidade: string | number;
  saldo_atual: string | number | null;
  oportunidade_ajustada: string | number | null;
}

export async function listarPorCategoria(): Promise<ResumoCategoria[]> {
  const linhas = await query<LinhaCategoria>(`
    select categoria,
           count(*) as quantidade,
           sum(saldo_atual) as saldo_atual,
           sum(oportunidade_ajustada) as oportunidade_ajustada
    from vw_forecast
    group by categoria
    order by categoria
  `);

  return linhas.map((linha) => ({
    categoria: linha.categoria,
    quantidade: paraNumero(linha.quantidade),
    saldoAtual: paraNumero(linha.saldo_atual),
    oportunidadeAjustada: paraNumero(linha.oportunidade_ajustada),
  }));
}

interface LinhaOportunidade {
  n4: string;
  projeto: string;
  oportunidade_ajustada: string | number | null;
  justificativa: string | null;
  responsavel: string | null;
  confianca: string | null;
}

export async function listarMaioresOportunidades(limite = 10): Promise<MaiorOportunidade[]> {
  const linhas = await query<LinhaOportunidade>(
    `
    select n4, projeto, oportunidade_ajustada, justificativa, responsavel, confianca
    from vw_forecast
    where categoria = 'OPORTUNIDADE'
    order by oportunidade_ajustada desc
    limit $1
    `,
    [validarLimite(limite)],
  );

  return linhas.map((linha) => ({
    n4: linha.n4,
    projeto: linha.projeto,
    oportunidadeAjustada: paraNumero(linha.oportunidade_ajustada),
    justificativa: linha.justificativa,
    responsavel: linha.responsavel,
    confianca: linha.confianca,
  }));
}

interface LinhaPressao {
  n4: string;
  projeto: string;
  saldo_atual: string | number | null;
  oportunidade_ajustada: string | number | null;
  justificativa: string | null;
  responsavel: string | null;
}

export async function listarMaioresPressoes(limite = 10): Promise<MaiorPressao[]> {
  const linhas = await query<LinhaPressao>(
    `
    select n4, projeto, saldo_atual, oportunidade_ajustada, justificativa, responsavel
    from vw_forecast
    where categoria = 'PRESSAO'
    order by oportunidade_ajustada asc
    limit $1
    `,
    [validarLimite(limite)],
  );

  return linhas.map((linha) => ({
    n4: linha.n4,
    projeto: linha.projeto,
    saldoAtual: paraNumero(linha.saldo_atual),
    oportunidadeAjustada: paraNumero(linha.oportunidade_ajustada),
    justificativa: linha.justificativa,
    responsavel: linha.responsavel,
  }));
}
