'use client';

export function BotaoImprimir() {
  return (
    <button type="button" className="botao-discreto nao-imprimir" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
