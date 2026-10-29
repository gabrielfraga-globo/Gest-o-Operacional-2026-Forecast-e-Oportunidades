const PARAMETROS_CONFIRMACAO = ['token', 'callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const;

export function montarUrlConfirmacao(urlVerificacao: string, base: string): string {
  const original = new URL(urlVerificacao);
  if (!original.searchParams.get('token')) {
    throw new Error('Link de acesso sem token.');
  }

  const params = new URLSearchParams();
  for (const nome of PARAMETROS_CONFIRMACAO) {
    const valor = original.searchParams.get(nome);
    if (valor) {
      params.set(nome, valor);
    }
  }
  return `${base}/entrar?${params.toString()}`;
}
