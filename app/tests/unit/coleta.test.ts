import { describe, expect, it } from 'vitest';
import { calcularPrevia } from '@/lib/previa';
import { centavosParaTexto, interpretarValor } from '@/lib/valor';
import { previsaoSchema } from '@/lib/previsao-schema';

describe('interpretarValor', () => {
  it.each([
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1,5', 150],
    ['0', 0],
    ['0,05', 5],
    [' 10,00 ', 1000],
  ])('aceita %s', (texto, centavos) => {
    expect(interpretarValor(texto)).toEqual({ ok: true, centavos });
  });

  it.each([
    ['', 'Informe o valor.'],
    ['-1', 'O valor não pode ser negativo.'],
    ['-0,01', 'O valor não pode ser negativo.'],
    ['1,234', 'Use até 2 casas decimais'],
    ['1.234,56', 'Use até 2 casas decimais'],
    ['abc', 'Use até 2 casas decimais'],
    ['1,2,3', 'Use até 2 casas decimais'],
    ['12345678901234', 'Valor muito grande.'],
  ])('rejeita %s', (texto, mensagem) => {
    const resultado = interpretarValor(texto);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain(mensagem);
  });

  it('centavosParaTexto usa sempre 2 casas', () => {
    expect(centavosParaTexto(123456)).toBe('1234.56');
    expect(centavosParaTexto(5)).toBe('0.05');
    expect(centavosParaTexto(0)).toBe('0.00');
  });
});

describe('calcularPrevia', () => {
  it('forecast = realizado + previsão e oportunidade = ORC+BG − forecast', () => {
    const previa = calcularPrevia(100, 40, 10.1);
    expect(previa.forecastFechamento).toBe(50.1);
    expect(previa.oportunidade).toBe(49.9);
  });

  it('não acumula erro de ponto flutuante em centavos', () => {
    const previa = calcularPrevia(0.3, 0.1, 0.2);
    expect(previa.forecastFechamento).toBe(0.3);
    expect(previa.oportunidade).toBe(0);
  });
});

describe('previsaoSchema', () => {
  const base = {
    linha_id: '7',
    versao_esperada: '0',
    previsao_futura: '1234,50',
    classificacao: 'COMPROMISSO',
    confianca: 'ALTA',
    justificativa: 'Contrato assinado',
    proxima_acao: '',
    responsavel: 'Ana',
  };

  it('converte tipos e valor para centavos', () => {
    const resultado = previsaoSchema.safeParse(base);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toMatchObject({
        linha_id: 7,
        versao_esperada: 0,
        previsao_futura: 123450,
        confianca: 'ALTA',
        proxima_acao: null,
      });
    }
  });

  it('rejeita valor negativo e campo acima do limite', () => {
    const negativo = previsaoSchema.safeParse({ ...base, previsao_futura: '-5' });
    expect(negativo.success).toBe(false);

    const longo = previsaoSchema.safeParse({ ...base, justificativa: 'x'.repeat(1001) });
    expect(longo.success).toBe(false);
  });

  it('exige confiança quando a classificação não é A_VALIDAR', () => {
    const semConfianca = previsaoSchema.safeParse({ ...base, confianca: '' });
    expect(semConfianca.success).toBe(false);

    const aValidar = previsaoSchema.safeParse({ ...base, classificacao: 'A_VALIDAR', confianca: '' });
    expect(aValidar.success).toBe(true);
  });

  it('rejeita classificação e confiança fora do domínio', () => {
    expect(previsaoSchema.safeParse({ ...base, classificacao: 'OUTRA' }).success).toBe(false);
    expect(previsaoSchema.safeParse({ ...base, confianca: 'MUITO' }).success).toBe(false);
  });
});
