export type ValorInterpretado = { ok: true; centavos: number } | { ok: false; erro: string };

const FORMATO = /^\d+(?:[.,]\d{1,2})?$/;
const MAXIMO_DIGITOS_INTEIROS = 13;

export function interpretarValor(texto: string): ValorInterpretado {
  const limpo = texto.trim();
  if (limpo === '') return { ok: false, erro: 'Informe o valor.' };
  if (limpo.startsWith('-')) return { ok: false, erro: 'O valor não pode ser negativo.' };
  if (!FORMATO.test(limpo)) {
    return {
      ok: false,
      erro: 'Use até 2 casas decimais, com vírgula ou ponto (ex.: 1234,56). Não use separador de milhar.',
    };
  }

  const [inteiro, decimais = ''] = limpo.split(/[.,]/);
  if (inteiro === undefined || inteiro.length > MAXIMO_DIGITOS_INTEIROS) {
    return { ok: false, erro: 'Valor muito grande.' };
  }

  return { ok: true, centavos: Number(inteiro) * 100 + Number(decimais.padEnd(2, '0')) };
}

export function centavosParaTexto(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}
