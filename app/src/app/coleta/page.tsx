import { exigirSessao } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaColeta() {
  await exigirSessao();
  return (
    <section className="vazio" aria-labelledby="coleta-titulo">
      <p className="eyebrow">COLETA</p>
      <h1 id="coleta-titulo" className="h1">
        Em construção
      </h1>
      <p className="lead">Esta tela ainda não está disponível.</p>
    </section>
  );
}
