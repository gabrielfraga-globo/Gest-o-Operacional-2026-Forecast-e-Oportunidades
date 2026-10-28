import { FormularioLogin } from "./formulario-login";

export const dynamic = "force-dynamic";

const MENSAGENS_ERRO: Record<string, string> = {
  "sem-acesso":
    "Este e-mail não tem acesso ao Forecast Opex 2026. Fale com o administrador.",
  "link-invalido":
    "Este link expirou ou já foi usado. Peça um novo link abaixo.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagemErro = erro ? MENSAGENS_ERRO[erro] : undefined;

  return (
    <section className="vazio" aria-labelledby="login-titulo">
      <p className="eyebrow">FIN. OPERACIONAL</p>
      <h1 id="login-titulo" className="h1 titulo-area">
        Entrar
      </h1>
      <p className="lead">Informe seu e-mail corporativo para receber um link de acesso.</p>
      {mensagemErro && (
        <p className="aviso-login" role="alert">
          {mensagemErro}
        </p>
      )}
      <FormularioLogin />
    </section>
  );
}
