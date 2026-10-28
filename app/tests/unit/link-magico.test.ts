import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  enviarLinkAcesso: vi.fn(),
}));

vi.mock('@/server/db', () => ({ query: mocks.query }));
vi.mock('@/server/email', () => ({ enviarLinkAcesso: mocks.enviarLinkAcesso }));

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

    await enviarLinkMagico('ana@exemplo.com', 'https://app.exemplo.com/link');

    expect(mocks.enviarLinkAcesso).toHaveBeenCalledWith(
      'ana@exemplo.com',
      'Ana Souza',
      'https://app.exemplo.com/link',
    );
  });
});
