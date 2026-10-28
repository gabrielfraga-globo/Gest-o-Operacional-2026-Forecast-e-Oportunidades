'use server';

import { revalidatePath } from 'next/cache';
import { previsaoSchema, type ResultadoSalvar } from '@/lib/previsao-schema';
import { gravarPrevisao } from '@/server/coleta';
import { exigirSessao } from '@/server/sessao';

const CAMPOS = [
  'linha_id',
  'versao_esperada',
  'previsao_futura',
  'classificacao',
  'confianca',
  'justificativa',
  'proxima_acao',
  'responsavel',
] as const;

export async function salvarPrevisao(formData: FormData): Promise<ResultadoSalvar> {
  const usuario = await exigirSessao();

  const campos = Object.fromEntries(
    CAMPOS.map((campo) => {
      const valor = formData.get(campo);
      return [campo, typeof valor === 'string' ? valor : ''];
    }),
  );

  const entrada = previsaoSchema.safeParse(campos);
  if (!entrada.success) {
    const erros: Record<string, string> = {};
    for (const problema of entrada.error.issues) {
      const campo = String(problema.path[0] ?? 'formulario');
      erros[campo] ??= problema.message;
    }
    return { ok: false, erros };
  }

  const resultado = await gravarPrevisao(usuario, entrada.data);
  if (!resultado.ok) {
    return { ok: false, conflito: resultado.conflito, mensagem: resultado.mensagem };
  }

  revalidatePath(`/coleta/${resultado.n4_id}`);
  return { ok: true, versao: resultado.versao };
}
