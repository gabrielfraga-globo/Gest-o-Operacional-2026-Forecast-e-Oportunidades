import { redirect } from "next/navigation";
import { listarN4 } from "@/server/coleta";
import { exigirSessao } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaColeta() {
  const usuario = await exigirSessao();
  const n4s = await listarN4(usuario.email);

  const destino = n4s.find((n4) => n4.linhas_editaveis > 0) ?? n4s[0];
  if (destino !== undefined) redirect(`/coleta/${destino.n4_id}`);

  return (
    <section className="vazio" aria-labelledby="coleta-titulo">
      <p className="eyebrow">COLETA</p>
      <h1 id="coleta-titulo" className="h1">
        Nenhum N4 disponível
      </h1>
      <p className="lead">Não há linhas de forecast para exibir.</p>
    </section>
  );
}
