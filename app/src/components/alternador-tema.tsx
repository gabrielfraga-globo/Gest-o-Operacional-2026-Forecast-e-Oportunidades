'use client';

const CHAVE = 'tema';
const TEMAS = [
  { valor: 'dark', rotulo: 'Tema escuro' },
  { valor: 'light', rotulo: 'Tema claro' },
] as const;

function alternarPara(tema: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = tema;
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Armazenamento indisponível: o tema vale somente nesta página.
  }
}

export function AlternadorTema() {
  return (
    <div className="alternador-tema" role="group" aria-label="Tema">
      {TEMAS.map((tema) => (
        <button
          key={tema.valor}
          type="button"
          data-tema={tema.valor}
          aria-label={tema.rotulo}
          title={tema.rotulo}
          onClick={() => alternarPara(tema.valor)}
        >
          {tema.valor === 'dark' ? '☾' : '☀'}
        </button>
      ))}
    </div>
  );
}
