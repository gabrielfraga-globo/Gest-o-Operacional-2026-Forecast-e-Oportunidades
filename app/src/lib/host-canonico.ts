// Redireciona deploys *.vercel.app de produção para a URL oficial; null quando não se aplica.
export function destinoCanonico(
  host: string,
  urlOficial: string | undefined,
  vercelEnv: string | undefined,
): string | null {
  if (vercelEnv !== 'production' || !urlOficial) {
    return null;
  }
  const hostAtual = host.toLowerCase();
  const oficial = new URL(urlOficial);
  if (!hostAtual.endsWith('.vercel.app') || hostAtual === oficial.host) {
    return null;
  }
  return oficial.origin;
}
