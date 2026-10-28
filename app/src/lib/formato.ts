const LOCALE = 'pt-BR';

function sinal(valor: number): string {
  return valor < 0 ? '-' : '';
}

function arredondarMeioParaCima(valor: number, casas: number): number {
  const fator = 10 ** casas;
  const absoluto = Math.abs(valor);
  const escalado = Number((absoluto * fator).toFixed(6));
  return Math.round(escalado) / fator;
}

export function formatarReais(valor: number): string {
  const absoluto = arredondarMeioParaCima(valor, 2);
  const texto = absoluto.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sinal(valor)}R$ ${texto}`;
}

export function formatarReaisInteiro(valor: number): string {
  const absoluto = arredondarMeioParaCima(valor, 0);
  const texto = absoluto.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sinal(valor)}R$ ${texto}`;
}

export function formatarMilhoes(valor: number): string {
  const milhoes = arredondarMeioParaCima(valor / 1_000_000, 1);
  const texto = milhoes.toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sinal(valor)}R$ ${texto} mi`;
}

export function formatarPercentual(fracao: number): string {
  const percentual = arredondarMeioParaCima(fracao * 100, 1);
  const texto = percentual.toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sinal(fracao)}${texto}%`;
}
