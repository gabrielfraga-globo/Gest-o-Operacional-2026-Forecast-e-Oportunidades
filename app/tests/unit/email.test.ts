import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));

import { enviarLinkAcesso } from '@/server/email';

const VARIAVEIS_SMTP = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
const SMTP_COMPLETO = {
  SMTP_HOST: 'smtp.exemplo.com',
  SMTP_PORT: '465',
  SMTP_USER: 'usuario-smtp',
  SMTP_PASS: 'senha-ficticia',
  EMAIL_FROM: 'Forecast <nao-responder@exemplo.com>',
};

const envOriginal = { ...process.env };

function definirEnv(valores: Record<string, string | undefined>): void {
  for (const nome of VARIAVEIS_SMTP) {
    delete process.env[nome];
  }
  for (const [nome, valor] of Object.entries(valores)) {
    if (valor !== undefined) process.env[nome] = valor;
  }
}

describe('enviarLinkAcesso', () => {
  beforeEach(() => {
    mocks.sendMail.mockReset().mockResolvedValue({});
    mocks.createTransport.mockReset().mockReturnValue({ sendMail: mocks.sendMail });
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('em desenvolvimento sem SMTP escreve o link no console do servidor', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    definirEnv({});
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await enviarLinkAcesso('ana@exemplo.com', 'Ana', 'https://app.exemplo.com/api/auth/magic-link/verify?token=x');

    expect(info).toHaveBeenCalledWith(
      '[DEV] link de acesso para ana@exemplo.com: https://app.exemplo.com/api/auth/magic-link/verify?token=x',
    );
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('em produção sem SMTP lança erro claro', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    definirEnv({});

    await expect(enviarLinkAcesso('ana@exemplo.com', 'Ana', 'https://x')).rejects.toThrow(
      /SMTP não configurado em produção/,
    );
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('configuração SMTP parcial lança erro nomeando a variável faltante, mesmo em desenvolvimento', async () => {
      vi.stubEnv('NODE_ENV', 'development');
    definirEnv({ ...SMTP_COMPLETO, SMTP_PASS: undefined });

    await expect(enviarLinkAcesso('ana@exemplo.com', 'Ana', 'https://x')).rejects.toThrow(
      /falta SMTP_PASS/,
    );
  });

  it('com SMTP completo envia pelo transporte na porta 465 com TLS', async () => {
      vi.stubEnv('NODE_ENV', 'production');
    definirEnv(SMTP_COMPLETO);

    await enviarLinkAcesso('ana@exemplo.com', 'Ana', 'https://app.exemplo.com/link');

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.exemplo.com',
        port: 465,
        secure: true,
        auth: { user: 'usuario-smtp', pass: 'senha-ficticia' },
      }),
    );
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Forecast <nao-responder@exemplo.com>',
        to: 'ana@exemplo.com',
        subject: 'Seu acesso ao Forecast Opex 2026',
        text: expect.stringContaining('https://app.exemplo.com/link'),
        html: expect.stringContaining('href="https://app.exemplo.com/link"'),
      }),
    );
    const mensagem = mocks.sendMail.mock.calls[0]?.[0] as { text: string };
    expect(mensagem.text).toContain('15 minutos');
  });

  it('usa TLS somente na porta 465', async () => {
      vi.stubEnv('NODE_ENV', 'production');
    definirEnv({ ...SMTP_COMPLETO, SMTP_PORT: '587' });

    await enviarLinkAcesso('ana@exemplo.com', 'Ana', 'https://x');

    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }));
  });

  it('escapa o nome no HTML', async () => {
      vi.stubEnv('NODE_ENV', 'production');
    definirEnv(SMTP_COMPLETO);

    await enviarLinkAcesso('ana@exemplo.com', '<script>x</script>', 'https://x');

    const mensagem = mocks.sendMail.mock.calls[0]?.[0] as { html: string };
    expect(mensagem.html).toContain('&lt;script&gt;');
    expect(mensagem.html).not.toContain('<script>');
  });
});
