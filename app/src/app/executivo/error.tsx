"use client";

export default function ErroExecutivo({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="erro-card" role="alert">
      <h2>Não foi possível carregar a visão executiva</h2>
      <p>Verifique a conexão com o banco e tente novamente.</p>
      <button type="button" onClick={() => reset()}>
        Tentar de novo
      </button>
    </section>
  );
}
