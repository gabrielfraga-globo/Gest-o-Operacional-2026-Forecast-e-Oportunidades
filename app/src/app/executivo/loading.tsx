export default function Loading() {
  return (
    <div role="status" aria-label="Carregando visão executiva" className="area-executivo">
      <div className="executivo-grade" aria-hidden="true">
        <div className="painel-principal">
          <div className="esqueleto" style={{ width: 160, height: 14, minHeight: 0 }} />
          <div className="esqueleto" style={{ width: 360, height: 40, minHeight: 0, marginTop: 12 }} />
          <div className="esqueleto" style={{ width: '90%', height: 20, minHeight: 0, marginTop: 12 }} />
          <section className="grade-kpi" style={{ marginTop: 24 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div className="esqueleto" key={i} />
            ))}
          </section>
          <div className="esqueleto" style={{ height: 260, marginTop: 24 }} />
          <div className="esqueleto" style={{ height: 260, marginTop: 24 }} />
        </div>
        <aside className="painel-lateral">
          <div className="esqueleto" style={{ height: 320 }} />
          <div className="esqueleto" style={{ height: 180, marginTop: 24 }} />
        </aside>
      </div>
    </div>
  );
}
