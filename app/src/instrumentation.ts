// Valida as variáveis obrigatórias ao subir o servidor, antes de atender a primeira requisição.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { obterAmbiente } = await import('./server/ambiente');
    obterAmbiente();
  }
}
