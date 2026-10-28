import { describe, expect, it } from 'vitest';
import {
  degraus,
  dominioComZero,
  fracaoSegura,
  intervaloBarra,
  posicaoNoEixo,
} from '@/lib/graficos';

describe('dominioComZero', () => {
  it('inclui zero quando todos os valores são positivos', () => {
    expect(dominioComZero([10, 20])).toEqual({ min: 0, max: 20 });
  });

  it('inclui zero quando há negativos', () => {
    expect(dominioComZero([-30, 40])).toEqual({ min: -30, max: 40 });
  });

  it('usa escala de 0 a 1 quando todos são zero', () => {
    expect(dominioComZero([0, 0])).toEqual({ min: 0, max: 1 });
    expect(dominioComZero([])).toEqual({ min: 0, max: 1 });
  });

  it('ignora valores não finitos', () => {
    expect(dominioComZero([NaN, 5])).toEqual({ min: 0, max: 5 });
  });
});

describe('posicaoNoEixo', () => {
  it('mapeia os extremos para a largura inteira', () => {
    const dominio = { min: -30, max: 70 };
    expect(posicaoNoEixo(-30, dominio, 200)).toBe(0);
    expect(posicaoNoEixo(70, dominio, 200)).toBe(200);
    expect(posicaoNoEixo(0, dominio, 200)).toBe(60);
  });
});

describe('intervaloBarra', () => {
  it('desenha barra positiva a partir de zero', () => {
    const dominio = { min: 0, max: 100 };
    expect(intervaloBarra(0, 25, dominio, 200)).toEqual({ x: 0, largura: 50 });
  });

  it('desenha barra negativa à esquerda do zero, com largura positiva', () => {
    const dominio = { min: -50, max: 50 };
    const barra = intervaloBarra(0, -25, dominio, 200);
    expect(barra.x).toBeCloseTo(50, 10);
    expect(barra.largura).toBeCloseTo(50, 10);
  });

  it('largura é sempre não negativa, independentemente da ordem dos extremos', () => {
    const dominio = { min: -10, max: 10 };
    expect(intervaloBarra(8, 2, dominio, 100).largura).toBeCloseTo(30, 10);
    expect(intervaloBarra(2, 8, dominio, 100).largura).toBeCloseTo(30, 10);
  });
});

describe('fracaoSegura', () => {
  it('calcula a fração normal', () => {
    expect(fracaoSegura(5, 10)).toBe(0.5);
  });

  it('limita a 0..1', () => {
    expect(fracaoSegura(12, 10)).toBe(1);
    expect(fracaoSegura(-1, 10)).toBe(0);
  });

  it('retorna zero para total zero ou não finito', () => {
    expect(fracaoSegura(5, 0)).toBe(0);
    expect(fracaoSegura(5, Number.NaN)).toBe(0);
  });
});

describe('degraus', () => {
  it('encadeia ORC+BG, realizado, previsão futura e saldo projetado', () => {
    const passos = degraus(630, 300, 550);
    expect(passos.map((p) => p.rotulo)).toEqual([
      'ORC+BG',
      'Realizado',
      'Previsão futura',
      'Saldo projetado',
    ]);
    expect(passos[0]).toEqual({ rotulo: 'ORC+BG', inicio: 0, fim: 630, tipo: 'total' });
    expect(passos[1]).toEqual({ rotulo: 'Realizado', inicio: 330, fim: 630, tipo: 'reducao' });
    expect(passos[2]).toEqual({
      rotulo: 'Previsão futura',
      inicio: 80,
      fim: 330,
      tipo: 'reducao',
    });
    expect(passos[3]).toEqual({ rotulo: 'Saldo projetado', inicio: 0, fim: 80, tipo: 'total' });
  });

  it('mantém saldo projetado negativo abaixo de zero', () => {
    const saldo = degraus(100, 50, 150)[3];
    expect(saldo).toEqual({ rotulo: 'Saldo projetado', inicio: 0, fim: -50, tipo: 'total' });
  });
});
