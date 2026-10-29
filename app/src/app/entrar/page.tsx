import type { Metadata } from 'next';
import Link from 'next/link';
import { BotaoConfirmar } from './botao-confirmar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type ParametrosBusca = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

// Não chama o Better Auth: abrir a página não pode consumir o token de uso único.
export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const params = await searchParams;
  const token = primeiro(params.token);

  if (!token) {
    return (
      <section className="vazio" aria-labelledby="entrar-titulo">
        <p className="eyebrow">FIN. OPERACIONAL</p>
        <h1 id="entrar-titulo" className="h1 titulo-area">
          Entrar
        </h1>
        <p className="aviso-login" role="alert">
          Link incompleto. Peça um novo link.
        </p>
        <p>
          <Link href="/login">Ir para o login</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="vazio" aria-labelledby="entrar-titulo">
      <p className="eyebrow">FIN. OPERACIONAL</p>
      <h1 id="entrar-titulo" className="h1 titulo-area">
        Entrar
      </h1>
      <p className="lead">Clique no botão para concluir sua entrada no Forecast Opex 2026.</p>
      <BotaoConfirmar
        token={token}
        callbackURL={primeiro(params.callbackURL)}
        errorCallbackURL={primeiro(params.errorCallbackURL)}
        newUserCallbackURL={primeiro(params.newUserCallbackURL)}
      />
    </section>
  );
}
