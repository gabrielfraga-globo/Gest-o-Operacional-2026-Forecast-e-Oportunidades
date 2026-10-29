import { describe, expect, it } from 'vitest';
import { montarUrlConfirmacao } from '@/server/url-confirmacao';

const BASE = 'https://app.exemplo.com';
const VERIFICACAO =
  `${BASE}/api/auth/magic-link/verify?token=abc123&callbackURL=%2F` +
  '&errorCallbackURL=%2Flogin%3Ferro%3Dlink-invalido&newUserCallbackURL=%2Fbem-vindo';

describe('montarUrlConfirmacao', () => {
  it('preserva token, callbackURL, errorCallbackURL e newUserCallbackURL', () => {
    const resultado = new URL(montarUrlConfirmacao(VERIFICACAO, BASE));

    expect(resultado.pathname).toBe('/entrar');
    expect(resultado.searchParams.get('token')).toBe('abc123');
    expect(resultado.searchParams.get('callbackURL')).toBe('/');
    expect(resultado.searchParams.get('errorCallbackURL')).toBe('/login?erro=link-invalido');
    expect(resultado.searchParams.get('newUserCallbackURL')).toBe('/bem-vindo');
  });

  it('descarta parâmetros que não fazem parte da confirmação', () => {
    const url = `${VERIFICACAO}&foo=bar&utm_source=email`;

    const resultado = montarUrlConfirmacao(url, BASE);

    expect(resultado).not.toContain('foo');
    expect(resultado).not.toContain('utm_source');
  });

  it('omite os parâmetros opcionais que não existem na URL', () => {
    const resultado = new URL(montarUrlConfirmacao(`${BASE}/api/auth/magic-link/verify?token=abc123`, BASE));

    expect([...resultado.searchParams.keys()]).toEqual(['token']);
  });

  it('usa a base informada, não a origem da URL recebida', () => {
    const resultado = montarUrlConfirmacao(VERIFICACAO, 'https://outro.exemplo.com');

    expect(resultado.startsWith('https://outro.exemplo.com/entrar?')).toBe(true);
  });

  it('lança erro quando não há token', () => {
    expect(() => montarUrlConfirmacao(`${BASE}/api/auth/magic-link/verify?callbackURL=%2F`, BASE)).toThrow(
      'sem token',
    );
  });
});
