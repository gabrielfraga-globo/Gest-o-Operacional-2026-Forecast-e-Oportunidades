import 'server-only';

const VARIAVEIS_SMTP = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const;
const VARIAVEIS_BASE = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const;
const TAMANHO_MINIMO_SEGREDO = 32;

export type ConfigSmtp = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export type Ambiente = {
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
  smtp: ConfigSmtp | null;
};

// SMTP é opcional em desenvolvimento, mas configuração parcial é sempre erro.
type Env = Readonly<Record<string, string | undefined>>;

export function lerSmtp(env: Env): ConfigSmtp | null {
  const ausentes = VARIAVEIS_SMTP.filter((nome) => !env[nome]);
  if (ausentes.length === VARIAVEIS_SMTP.length) {
    return null;
  }
  if (ausentes.length > 0) {
    throw new Error(`Configuração SMTP incompleta: falta ${ausentes.join(', ')}.`);
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT inválida: informe um número de porta.');
  }
  return {
    host: env.SMTP_HOST as string,
    port,
    user: env.SMTP_USER as string,
    pass: env.SMTP_PASS as string,
    from: env.EMAIL_FROM as string,
  };
}

// Mensagens nunca incluem valores de variáveis, só os nomes.
export function validarAmbiente(env: Env): Ambiente {
  const producao = env.NODE_ENV === 'production';
  const exigidas: readonly string[] = producao ? [...VARIAVEIS_BASE, ...VARIAVEIS_SMTP] : VARIAVEIS_BASE;
  const ausentes = exigidas.filter((nome) => !env[nome]);
  if (ausentes.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${ausentes.join(', ')}. Veja docs/DEPLOY.md.`,
    );
  }

  const segredo = env.BETTER_AUTH_SECRET as string;
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error(`BETTER_AUTH_SECRET deve ter pelo menos ${TAMANHO_MINIMO_SEGREDO} caracteres.`);
  }

  let url: URL;
  try {
    url = new URL(env.BETTER_AUTH_URL as string);
  } catch {
    throw new Error('BETTER_AUTH_URL inválida: informe uma URL absoluta, como https://app.exemplo.com.');
  }
  if (producao && url.protocol !== 'https:') {
    throw new Error('BETTER_AUTH_URL deve usar https em produção.');
  }

  return {
    databaseUrl: env.DATABASE_URL as string,
    authSecret: segredo,
    authUrl: url.origin,
    smtp: lerSmtp(env),
  };
}

export function exigirDatabaseUrl(env: Env): string {
  if (!env.DATABASE_URL) {
    throw new Error('Variáveis de ambiente obrigatórias ausentes: DATABASE_URL. Veja docs/DEPLOY.md.');
  }
  return env.DATABASE_URL;
}

let ambienteValidado: Ambiente | null = null;

export function obterAmbiente(): Ambiente {
  if (!ambienteValidado) {
    ambienteValidado = validarAmbiente(process.env);
  }
  return ambienteValidado;
}
