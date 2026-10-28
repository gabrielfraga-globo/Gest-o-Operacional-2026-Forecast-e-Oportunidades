export default function Loading() {
  return (
    <div className="coleta" role="status" aria-label="Carregando coleta">
      <aside className="coleta-nav" aria-hidden="true">
        <div className="esqueleto" style={{ width: 120, height: 12, minHeight: 0 }} />
        {Array.from({ length: 6 }, (_, i) => (
          <div className="esqueleto" key={i} style={{ height: 36, minHeight: 0, marginTop: 8 }} />
        ))}
      </aside>
      <section aria-hidden="true">
        <div className="esqueleto" style={{ width: 360, height: 36, minHeight: 0 }} />
        <div className="esqueleto" style={{ width: 420, height: 20, minHeight: 0, marginTop: 12 }} />
        <div className="esqueleto" style={{ height: 320, marginTop: 24 }} />
      </section>
    </div>
  );
}
