import { describe, expect, it } from 'vitest';
import { formatarMilhoes, formatarPercentual, formatarReais, formatarReaisInteiro } from '@/lib/formato';

describe('formatarReais', () => {
  it('formata valores positivos com separador de milhar e vírgula decimal', () => {
    expect(formatarReais(68623868.85)).toBe('R$ 68.623.868,85');
  });

  it('formata negativos com sinal de menos', () => {
    expect(formatarReais(-1234.5)).toBe('-R$ 1.234,50');
  });

  it('formata zero', () => {
    expect(formatarReais(0)).toBe('R$ 0,00');
  });

  it('arredonda para duas casas', () => {
    expect(formatarReais(10.126)).toBe('R$ 10,13');
    expect(formatarReais(10.124)).toBe('R$ 10,12');
  });
});

describe('formatarReaisInteiro', () => {
  it('formata valores positivos sem centavos, com separador de milhar', () => {
    expect(formatarReaisInteiro(1157864.4)).toBe('R$ 1.157.864');
  });

  it('arredonda meio para cima', () => {
    expect(formatarReaisInteiro(1234.5)).toBe('R$ 1.235');
    expect(formatarReaisInteiro(1234.49)).toBe('R$ 1.234');
  });

  it('formata negativos com sinal de menos', () => {
    expect(formatarReaisInteiro(-1234.5)).toBe('-R$ 1.235');
  });

  it('não mostra sinal de menos para valor que arredonda para zero', () => {
    expect(formatarReaisInteiro(-0.2)).toBe('R$ 0');
  });

  it('formata zero', () => {
    expect(formatarReaisInteiro(0)).toBe('R$ 0');
  });
});

describe('formatarMilhoes', () => {
  it('formata valores positivos em milhões com uma casa', () => {
    expect(formatarMilhoes(68623868.85)).toBe('R$ 68,6 mi');
  });

  it('formata negativos com sinal de menos', () => {
    expect(formatarMilhoes(-2500000)).toBe('-R$ 2,5 mi');
  });

  it('formata zero', () => {
    expect(formatarMilhoes(0)).toBe('R$ 0,0 mi');
  });

  it('arredonda para uma casa', () => {
    expect(formatarMilhoes(68650000)).toBe('R$ 68,7 mi');
    expect(formatarMilhoes(68640000)).toBe('R$ 68,6 mi');
  });
});

describe('formatarPercentual', () => {
  it('formata fração como percentual com uma casa', () => {
    expect(formatarPercentual(0.7984)).toBe('79,8%');
  });

  it('formata negativos com sinal de menos', () => {
    expect(formatarPercentual(-0.052)).toBe('-5,2%');
  });

  it('formata zero', () => {
    expect(formatarPercentual(0)).toBe('0,0%');
  });

  it('arredonda para uma casa', () => {
    expect(formatarPercentual(0.5)).toBe('50,0%');
    expect(formatarPercentual(0.9996)).toBe('100,0%');
  });
});
