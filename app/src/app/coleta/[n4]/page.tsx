import { notFound } from "next/navigation";
import { NavegacaoColeta } from "@/components/navegacao-coleta";
import { TabelaColeta } from "@/components/tabela-coleta";
import { formatarMilhoes } from "@/lib/formato";
import { listarLinhas, listarN4 } from "@/server/coleta";
import { exigirSessao } from "@/server/sessao";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ n4: string }> };

export default async function PaginaN4({ params }: Props) {
  const { n4: parametro } = await params;
  const usuario = await exigirSessao();
  const n4Id = Number(parametro);

  const n4s = await listarN4(usuario.email);
  const indice = n4s.findIndex((n4) => n4.n4_id === n4Id);
  const atual = n4s[indice];
  if (!Number.isInteger(n4Id) || atual === undefined) notFound();

  const linhas = await listarLinhas(n4Id, usuario.email);
  const realizado = linhas.reduce((soma, linha) => soma + linha.realizado, 0);

  const itensNavegacao = n4s.map((n4, posicao) => ({
    id: n4.n4_id,
    rotulo: `${String(posicao + 1).padStart(2, "0")} · ${n4.n4}`,
    pendencias: n4.pendencias,
  }));

  return (
    <div className="coleta">
      <NavegacaoColeta itens={itensNavegacao} ativoId={n4Id} />

      <section className="coleta-principal" aria-labelledby="n4-titulo">
        <p className="eyebrow">COLETA DO FORECAST</p>
        <h1 id="n4-titulo" className="h1">
          {atual.n4}
        </h1>
        <p className="coleta-resumo num">
          <span>ORC+BG {formatarMilhoes(atual.orc_bg)}</span>
          <span>Realizado {formatarMilhoes(realizado)}</span>
          <span>Saldo {formatarMilhoes(atual.saldo_atual)}</span>
        </p>

        {linhas.length === 0 ? (
          <p className="lead">Nenhuma linha neste N4.</p>
        ) : (
          <TabelaColeta linhas={linhas} nomeUsuario={usuario.nome} />
        )}
      </section>
    </div>
  );
}
