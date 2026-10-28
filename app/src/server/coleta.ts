import 'server-only';
import { obterPool, query } from './db';
import { centavosParaTexto } from '@/lib/valor';
import type { PrevisaoDados, ResultadoSalvar } from '@/lib/previsao-schema';

export type N4Coleta = {
  n4_id: number;
  n4: string;
  total_linhas: number;
  linhas_completas: number;
  linhas_editaveis: number;
  pendencias: number;
  orc_bg: number;
  saldo_atual: number;
};

export type LinhaColeta = {
  linha_id: number;
  n4_id: number;
  projeto_id: number;
  n4: string;
  projeto: string;
  projeto_codigo: string;
  orc_bg: number;
  realizado: number;
  saldo_atual: number;
  previsao_futura: number | null;
  classificacao: string;
  confianca: string | null;
  justificativa: string | null;
  proxima_acao: string | null;
  responsavel: string | null;
  input_completo: boolean;
  forecast_fechamento: number;
  oportunidade_ajustada: number;
  categoria: string;
  versao: number;
  pode_editar: boolean;
};

type N4Bruto = Omit<N4Coleta, 'total_linhas' | 'linhas_completas' | 'linhas_editaveis' | 'pendencias' | 'orc_bg' | 'saldo_atual'> & {
  total_linhas: string;
  linhas_completas: string;
  linhas_editaveis: string;
  pendencias: string;
  orc_bg: string;
  saldo_atual: string;
};

type LinhaBruta = Omit<
  LinhaColeta,
  | 'orc_bg'
  | 'realizado'
  | 'saldo_atual'
  | 'previsao_futura'
  | 'forecast_fechamento'
  | 'oportunidade_ajustada'
  | 'versao'
> & {
  orc_bg: string;
  realizado: string;
  saldo_atual: string;
  previsao_futura: string | null;
  forecast_fechamento: string;
  oportunidade_ajustada: string;
  versao: string;
};

// pg devolve numeric e bigint como string; a conversão para number fica só aqui.
const comoNumero = (valor: string | null): number | null => (valor === null ? null : Number(valor));

export async function listarN4(email: string): Promise<N4Coleta[]> {
  const linhas = await query<N4Bruto>(
    `select vf.n4_id,
            vf.n4,
            count(*)::text as total_linhas,
            count(*) filter (where vf.input_completo)::text as linhas_completas,
            count(pv.linha_id)::text as linhas_editaveis,
            count(pv.linha_id) filter (where not vf.input_completo)::text as pendencias,
            sum(vf.orc_bg)::text as orc_bg,
            sum(vf.saldo_atual)::text as saldo_atual
       from vw_forecast vf
       left join vw_permissao_linha pv
         on pv.linha_id = vf.linha_id and pv.email = $1
      group by vf.n4_id, vf.n4
      order by sum(vf.orc_bg) desc`,
    [email],
  );

  return linhas.map((linha) => ({
    n4_id: linha.n4_id,
    n4: linha.n4,
    total_linhas: Number(linha.total_linhas),
    linhas_completas: Number(linha.linhas_completas),
    linhas_editaveis: Number(linha.linhas_editaveis),
    pendencias: Number(linha.pendencias),
    orc_bg: Number(linha.orc_bg),
    saldo_atual: Number(linha.saldo_atual),
  }));
}

export async function listarLinhas(n4Id: number, email: string): Promise<LinhaColeta[]> {
  const linhas = await query<LinhaBruta>(
    `select vf.linha_id,
            vf.n4_id,
            vf.projeto_id,
            vf.n4,
            vf.projeto,
            vf.projeto_codigo,
            vf.orc_bg::text,
            vf.realizado::text,
            vf.saldo_atual::text,
            vf.previsao_futura::text,
            vf.classificacao::text,
            vf.confianca::text,
            vf.justificativa,
            vf.proxima_acao,
            vf.responsavel,
            vf.input_completo,
            vf.forecast_fechamento::text,
            vf.oportunidade_ajustada::text,
            vf.categoria,
            coalesce(fi.versao, 0)::text as versao,
            exists (
              select 1 from vw_permissao_linha pv
               where pv.linha_id = vf.linha_id and pv.email = $2
            ) as pode_editar
       from vw_forecast vf
       left join forecast_input fi on fi.linha_id = vf.linha_id
      where vf.n4_id = $1
      order by vf.saldo_atual desc`,
    [n4Id, email],
  );

  return linhas.map((linha) => ({
    ...linha,
    orc_bg: Number(linha.orc_bg),
    realizado: Number(linha.realizado),
    saldo_atual: Number(linha.saldo_atual),
    previsao_futura: comoNumero(linha.previsao_futura),
    forecast_fechamento: Number(linha.forecast_fechamento),
    oportunidade_ajustada: Number(linha.oportunidade_ajustada),
    versao: Number(linha.versao),
  }));
}

type LinhaPermitida = { n4_id: number };

// Única escrita do módulo. Permissão e versão são checadas na mesma transação do insert/update.
export async function gravarPrevisao(
  usuario: { email: string },
  dados: PrevisaoDados,
): Promise<ResultadoSalvar & { n4_id?: number }> {
  const cliente = await obterPool().connect();
  try {
    await cliente.query('begin');

    const permitida = await cliente.query<LinhaPermitida>(
      `select vf.n4_id
         from vw_forecast vf
        where vf.linha_id = $1
          and exists (
            select 1 from vw_permissao_linha pv
             where pv.linha_id = vf.linha_id and pv.email = $2
          )`,
      [dados.linha_id, usuario.email],
    );
    const linha = permitida.rows[0];
    if (linha === undefined) {
      await cliente.query('rollback');
      return { ok: false, mensagem: 'Sem permissão para esta linha' };
    }

    const valores = [
      dados.linha_id,
      centavosParaTexto(dados.previsao_futura),
      dados.classificacao,
      dados.justificativa,
      dados.confianca,
      dados.proxima_acao,
      dados.responsavel,
      usuario.email,
    ];

    const gravado =
      dados.versao_esperada === 0
        ? await cliente.query<{ versao: number }>(
            `insert into forecast_input
               (linha_id, previsao_futura, classificacao, justificativa, confianca,
                proxima_acao, responsavel, atualizado_por, atualizado_em)
             values ($1, $2, $3, $4, $5, $6, $7, $8, now())
             on conflict (linha_id) do nothing
             returning versao`,
            valores,
          )
        : await cliente.query<{ versao: number }>(
            `update forecast_input
                set previsao_futura = $2,
                    classificacao = $3,
                    justificativa = $4,
                    confianca = $5,
                    proxima_acao = $6,
                    responsavel = $7,
                    atualizado_por = $8
              where linha_id = $1 and versao = $9
              returning versao`,
            [...valores, dados.versao_esperada],
          );

    const versao = gravado.rows[0]?.versao;
    if (versao === undefined) {
      await cliente.query('rollback');
      return {
        ok: false,
        conflito: true,
        mensagem: 'Outra pessoa salvou esta linha antes. Os dados foram recarregados.',
      };
    }

    await cliente.query('commit');
    return { ok: true, versao: Number(versao), n4_id: linha.n4_id };
  } catch (erro) {
    await cliente.query('rollback');
    throw erro;
  } finally {
    cliente.release();
  }
}
