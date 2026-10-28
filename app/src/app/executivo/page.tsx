import { exigirSessao } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaExecutivo() {
  await exigirSessao();
  return (
    <section className="vazio" aria-labelledby="executivo-titulo">
      <p className="eyebrow">VISÃO EXECUTIVA</p>
      <h1 id="executivo-titulo" className="h1">
        Em construção
      </h1>
      <p className="lead">Esta tela ainda não está disponível.</p>
    </section>
  );
}
