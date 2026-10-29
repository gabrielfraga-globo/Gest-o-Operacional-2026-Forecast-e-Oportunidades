import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  enviarLinkAcesso: vi.fn(),
}));

const VERIFICACAO =
  'https://app.exemplo.com/api/auth/magic-link/verify?token=abc123&callbackURL=%2F' +
  '&errorCallbackURL=%2Flogin%3Ferro%3Dlink-invalido';

vi.mock('@/server/db', () => ({ query: mocks.query }));
vi.mock('@/server/email', () => ({ enviarLinkAcesso: mocks.enviarLinkAcesso }));
vi.mock('@/server/ambiente', () => ({
  obterAmbiente: () => ({ authUrl: 'https://app.exemplo.com' }),
}));

import { enviarLinkMagico } from '@/server/link-magico';

describe('enviarLinkMagico', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.enviarLinkAcesso.mockReset().mockResolvedValue(undefined);
  });

  it('não envia nada para e-mail inexistente', async () => {
    mocks.query.mockResolvedValue([]);

    await expect(enviarLinkMagico('desconhecido@exemplo.com', 'https://x')).resolves.toBeUndefined();

    expect(mocks.enviarLinkAcesso).not.toHaveBeenCalled();
  });

  it('não envia nada para usuário inativo (a consulta filtra ativo)', async () => {
    mocks.query.mockResolvedValue([]);

    await enviarLinkMagico('inativo@exemplo.com', 'https://x');

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('and ativo'), ['inativo@exemplo.com']);
    expect(mocks.enviarLinkAcesso).not.toHaveBeenCalled();
  });

  it('normaliza o e-mail para minúsculas e sem espaços antes de consultar', async () => {
    mocks.query.mockResolvedValue([]);

    await enviarLinkMagico('  Ana@Exemplo.com ', 'https://x');

    expect(mocks.query).toHaveBeenCalledWith(expect.any(String), ['ana@exemplo.com']);
  });

  it('envia o link para usuário ativo com o nome cadastrado', async () => {
    mocks.query.mockResolvedValue([{ nome: 'Ana Souza' }]);

    await enviarLinkMagico('ana@exemplo.com', VERIFICACAO);

    expect(mocks.enviarLinkAcesso).toHaveBeenCalledWith(
      'ana@exemplo.com',
      'Ana Souza',
      'https://app.exemplo.com/entrar?token=abc123&callbackURL=%2F&errorCallbackURL=%2Flogin%3Ferro%3Dlink-invalido',
    );
  });

  it('o e-mail aponta para /entrar e não para a rota que consome o token', async () => {
    mocks.query.mockResolvedValue([{ nome: 'Ana Souza' }]);

    await enviarLinkMagico('ana@exemplo.com', VERIFICACAO);

    const link = mocks.enviarLinkAcesso.mock.calls[0]?.[2] as string;
    expect(link).toContain('/entrar?');
    expect(link).not.toContain('/api/auth/magic-link/verify');
  });
});

