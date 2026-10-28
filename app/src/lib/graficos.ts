export interface Dominio {
  readonly min: number;
  readonly max: number;
}

export interface Intervalo {
  readonly x: number;
  readonly largura: number;
}

export interface Degrau {
  readonly rotulo: string;
  readonly inicio: number;
  readonly fim: number;
  readonly tipo: 'total' | 'reducao';
}

export function dominioComZero(valores: readonly number[]): Dominio {
  const finitos = valores.filter(Number.isFinite);
  const min = Math.min(0, ...finitos);
  const max = Math.max(0, ...finitos);
  return min === max ? { min: 0, max: 1 } : { min, max };
}

export function posicaoNoEixo(valor: number, dominio: Dominio, largura: number): number {
  return ((valor - dominio.min) / (dominio.max - dominio.min)) * largura;
}

export function intervaloBarra(
  inicio: number,
  fim: number,
  dominio: Dominio,
  largura: number,
): Intervalo {
  const a = posicaoNoEixo(inicio, dominio, largura);
  const b = posicaoNoEixo(fim, dominio, largura);
  return { x: Math.min(a, b), largura: Math.abs(b - a) };
}

export function fracaoSegura(parte: number, total: number): number {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, parte / total));
}

export function degraus(orcBg: number, realizado: number, forecastFechamento: number): Degrau[] {
  const saldoProjetado = orcBg - forecastFechamento;
  return [
    { rotulo: 'ORC+BG', inicio: 0, fim: orcBg, tipo: 'total' },
    { rotulo: 'Realizado', inicio: orcBg - realizado, fim: orcBg, tipo: 'reducao' },
    {
      rotulo: 'Previsão futura',
      inicio: orcBg - forecastFechamento,
      fim: orcBg - realizado,
      tipo: 'reducao',
    },
    { rotulo: 'Saldo projetado', inicio: 0, fim: saldoProjetado, tipo: 'total' },
  ];
}
