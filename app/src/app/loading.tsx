export default function Loading() {
  return (
    <div role="status" aria-label="Carregando indicadores">
      <header className="cabecalho" aria-hidden="true">
        <div className="esqueleto" style={{ width: 160, height: 14, minHeight: 0 }} />
        <div className="esqueleto" style={{ width: 360, height: 40, minHeight: 0, marginTop: 12 }} />
        <div className="esqueleto" style={{ width: 420, height: 20, minHeight: 0, marginTop: 12 }} />
      </header>
      <section className="grade-kpi" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="esqueleto" key={i} />
        ))}
      </section>
    </div>
  );
}
