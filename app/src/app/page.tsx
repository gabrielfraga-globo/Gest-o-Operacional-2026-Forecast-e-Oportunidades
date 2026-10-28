import { getReconciliacao } from "@/server/reconciliacao";
import { formatarMilhoes, formatarPercentual } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Page() {
  const r = await getReconciliacao();
  const linhas = r.linhasRealSemOrcamento;

  const kpis = [
    {
      eyebrow: "ORC + BG",
      valor: formatarMilhoes(r.orcBg),
      contexto: "Total orçado no Opex 2026",
    },
    {
      eyebrow: "Realizado",
      valor: formatarMilhoes(r.realizado),
      contexto: "Total lançado até agora",
    },
    {
      eyebrow: "Saldo",
      valor: formatarMilhoes(r.saldo),
      contexto: "ORC + BG menos realizado",
    },
    {
      eyebrow: "Utilização",
      valor: r.utilizacao === null ? "—" : formatarPercentual(r.utilizacao),
      contexto: "Realizado sobre ORC + BG",
    },
    {
      eyebrow: "Real sem orçamento",
      valor: formatarMilhoes(r.realSemOrcamento),
      contexto: `${linhas} ${linhas === 1 ? "linha" : "linhas"} sem orçamento`,
    },
  ];

  return (
    <>
      <header className="cabecalho">
        <p className="eyebrow">FIN. OPERACIONAL</p>
        <h1 className="h1 titulo-area">Forecast Opex 2026</h1>
        <p className="lead">Reconciliação entre orçamento, realizado e saldo do Opex.</p>
      </header>
      <section className="grade-kpi" aria-label="Indicadores de reconciliação">
        {kpis.map((kpi) => (
          <article className="card-kpi" key={kpi.eyebrow}>
            <p className="card-kpi-eyebrow">{kpi.eyebrow}</p>
            <p className="kpi num">{kpi.valor}</p>
            <p className="card-kpi-contexto">{kpi.contexto}</p>
          </article>
        ))}
      </section>
    </>
  );
}
