import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { exigirDatabaseUrl, lerSmtp, validarAmbiente } = await import('@/server/ambiente');

const SEGREDO = 'x'.repeat(32);
const SMTP = {
  SMTP_HOST: 'smtp.exemplo.com',
  SMTP_PORT: '587',
  SMTP_USER: 'usuario',
  SMTP_PASS: 'senha-fake',
  EMAIL_FROM: 'Opex <nao-responda@exemplo.com>',
};
const BASE = {
  DATABASE_URL: 'postgres://u:p@h/db',
  BETTER_AUTH_SECRET: SEGREDO,
  BETTER_AUTH_URL: 'https://app.exemplo.com',
};

describe('validarAmbiente em produção', () => {
  it('aceita configuração completa e devolve a origem da URL', () => {
    const ambiente = validarAmbiente({ ...BASE, ...SMTP, NODE_ENV: 'production' });
    expect(ambiente.authUrl).toBe('https://app.exemplo.com');
    expect(ambiente.authSecret).toBe(SEGREDO);
    expect(ambiente.smtp?.port).toBe(587);
  });

  it('lista todas as variáveis ausentes, sem valores', () => {
    const erro = () => validarAmbiente({ NODE_ENV: 'production', ...BASE, DATABASE_URL: '' });
    expect(erro).toThrow('DATABASE_URL');
    expect(erro).not.toThrow(/postgres:\/\/u:p/);
    expect(() => validarAmbiente({ NODE_ENV: 'production', BETTER_AUTH_SECRET: SEGREDO, BETTER_AUTH_URL: 'https://a.b', ...SMTP })).toThrow(
      'Variáveis de ambiente obrigatórias ausentes: DATABASE_URL',
    );
  });

  it('exige todas as variáveis SMTP', () => {
    expect(() => validarAmbiente({ ...BASE, ...SMTP, SMTP_PASS: undefined, NODE_ENV: 'production' })).toThrow('SMTP_PASS');
  });

  it('rejeita BETTER_AUTH_URL que não é https', () => {
    expect(() =>
      validarAmbiente({ ...BASE, ...SMTP, BETTER_AUTH_URL: 'http://app.exemplo.com', NODE_ENV: 'production' }),
    ).toThrow('deve usar https em produção');
  });
});

describe('validarAmbiente em desenvolvimento', () => {
  it('não exige SMTP', () => {
    const ambiente = validarAmbiente({ ...BASE, BETTER_AUTH_URL: 'http://localhost:3000', NODE_ENV: 'development' });
    expect(ambiente.smtp).toBeNull();
    expect(ambiente.authUrl).toBe('http://localhost:3000');
  });

  it('exige DATABASE_URL, segredo e URL', () => {
    expect(() => validarAmbiente({ NODE_ENV: 'development' })).toThrow(
      'DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL',
    );
  });

  it('rejeita segredo com menos de 32 caracteres', () => {
    expect(() =>
      validarAmbiente({ ...BASE, BETTER_AUTH_SECRET: 'curto', NODE_ENV: 'development' }),
    ).toThrow('pelo menos 32 caracteres');
  });

  it('rejeita BETTER_AUTH_URL que não é uma URL absoluta', () => {
    expect(() => validarAmbiente({ ...BASE, BETTER_AUTH_URL: 'app-sem-protocolo', NODE_ENV: 'development' })).toThrow(
      'BETTER_AUTH_URL inválida',
    );
  });
});

describe('lerSmtp', () => {
  it('retorna null quando nenhuma variável SMTP está definida', () => {
    expect(lerSmtp({})).toBeNull();
  });

  it('informa configuração parcial pelo nome da variável', () => {
    expect(() => lerSmtp({ SMTP_HOST: 'smtp.exemplo.com' })).toThrow(
      'Configuração SMTP incompleta: falta SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.',
    );
  });

  it('rejeita porta inválida', () => {
    expect(() => lerSmtp({ ...SMTP, SMTP_PORT: 'abc' })).toThrow('SMTP_PORT inválida');
  });
});

describe('exigirDatabaseUrl', () => {
  it('devolve a DATABASE_URL quando definida', () => {
    expect(exigirDatabaseUrl({ DATABASE_URL: 'postgres://h/db' })).toBe('postgres://h/db');
  });

  it('falha com mensagem clara quando ausente', () => {
    expect(() => exigirDatabaseUrl({})).toThrow('DATABASE_URL');
  });
});
