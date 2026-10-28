import { z } from 'zod';
import { interpretarValor } from './valor';

export const CLASSIFICACOES = [
  'COMPROMISSO',
  'POSTERGACAO',
  'CANCELAMENTO',
  'ECONOMIA',
  'A_VALIDAR',
] as const;

export const CONFIANCAS = ['ALTA', 'MEDIA', 'BAIXA'] as const;

export const LIMITE_JUSTIFICATIVA = 1000;
export const LIMITE_PROXIMA_ACAO = 500;
export const LIMITE_RESPONSAVEL = 120;

const inteiroTexto = (mensagem: string) =>
  z
    .string({ error: mensagem })
    .trim()
    .regex(/^\d+$/, mensagem)
    .transform(Number);

const textoOpcional = (rotulo: string, limite: number) =>
  z
    .string({ error: `${rotulo} inválido.` })
    .trim()
    .max(limite, `${rotulo}: no máximo ${limite} caracteres.`)
    .transform((valor) => (valor === '' ? null : valor));

const previsaoFutura = z.string({ error: 'Informe a previsão.' }).transform((texto, ctx) => {
  const resultado = interpretarValor(texto);
  if (!resultado.ok) {
    ctx.addIssue({ code: 'custom', message: resultado.erro });
    return z.NEVER;
  }
  return resultado.centavos;
});

const confianca = z
  .string({ error: 'Informe a confiança.' })
  .trim()
  .transform((valor) => (valor === '' ? null : valor))
  .pipe(z.enum(CONFIANCAS, { error: 'Confiança inválida.' }).nullable());

export const previsaoSchema = z
  .object({
    linha_id: inteiroTexto('Linha inválida.'),
    versao_esperada: inteiroTexto('Versão inválida.'),
    previsao_futura: previsaoFutura,
    classificacao: z.enum(CLASSIFICACOES, { error: 'Classificação inválida.' }),
    confianca,
    justificativa: textoOpcional('Justificativa', LIMITE_JUSTIFICATIVA),
    proxima_acao: textoOpcional('Próxima ação', LIMITE_PROXIMA_ACAO),
    responsavel: textoOpcional('Responsável', LIMITE_RESPONSAVEL),
  })
  .superRefine((dados, ctx) => {
    if (dados.classificacao !== 'A_VALIDAR' && dados.confianca === null) {
      ctx.addIssue({ code: 'custom', path: ['confianca'], message: 'Informe a confiança.' });
    }
  });

export type PrevisaoDados = z.output<typeof previsaoSchema>;

export type ResultadoSalvar =
  | { ok: true; versao: number }
  | { ok: false; erros?: Record<string, string>; conflito?: boolean; mensagem?: string };
