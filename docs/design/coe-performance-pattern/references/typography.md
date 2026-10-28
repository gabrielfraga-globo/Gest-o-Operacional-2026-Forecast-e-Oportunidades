# Tipografia — detalhes

## Características observadas

- **Sans geométrica**: "o", "e", "a" redondos e abertos; "f" com haste reta; terminais cortados retos.
- **Peso muito alto** no display (marca): contraste forte com o fundo escuro, letras quase se tocando.
- **Tracking negativo leve** no display e na frase de apoio; **tracking largo** só em textos curtos em maiúsculas.
- **Uma família** em toda a interface; hierarquia por **peso** (500 / 700 / 800) e **caixa** (maiúsculas nos rótulos).
- Rótulos pequenos (10–11 px) compensados com peso 800 e maiúsculas, para legibilidade em fundo escuro.

## Escala proposta (base 16 px, razão ≈ 1,25 com saltos no display)

| Token | px | rem | Peso | line-height | letter-spacing | Caixa |
|---|---|---|---|---|---|---|
| `--fs-display` | 80 | 5 | 800 | 1.0 | −0.02em | normal |
| `--fs-h1` | 36 | 2.25 | 800 | 1.15 | −0.01em | normal |
| `--fs-kpi` | 32 | 2 | 800 | 1.1 | −0.01em | normal, `tabular-nums` |
| `--fs-h2` | 22 | 1.375 | 700 | 1.25 | −0.005em | normal |
| `--fs-lead` | 19 | 1.1875 | 500 | 1.4 | −0.01em | normal |
| `--fs-body` | 15 | 0.9375 | 500 | 1.5 | 0 | normal |
| `--fs-nav` | 14 | 0.875 | 700 | 1.2 | 0 | normal |
| `--fs-eyebrow` | 12 | 0.75 | 700 | 1.2 | 0.3em | MAIÚSCULAS |
| `--fs-label` | 11 | 0.6875 | 800 | 1.2 | 0.04em | MAIÚSCULAS |

Números financeiros: sempre `font-variant-numeric: tabular-nums;` e alinhados à direita em tabelas.

## Família

1. **Primeiro, confirme a fonte real do site** (DevTools → Console):
   ```js
   ['h1','nav','body'].map(s => [s, getComputedStyle(document.querySelector(s)).fontFamily])
   ```
   Se for uma fonte licenciada pela empresa (ex.: Gilroy), use os arquivos e a licença internos.
2. **Sem acesso à fonte original**, use uma alternativa livre do Google Fonts com o mesmo caráter:
   - **Outfit** (800/700/500) — geométrica, redonda, mais próxima no peso do display;
   - **Plus Jakarta Sans** (800/700/500) — geométrica, melhor legibilidade em tamanhos pequenos.
   Recomendação: Plus Jakarta Sans, por render melhor nos rótulos de 11 px em fundo escuro.

## CSS de partida

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');

:root {
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;

  --fs-display: 5rem;   --fs-h1: 2.25rem;  --fs-kpi: 2rem;    --fs-h2: 1.375rem;
  --fs-lead: 1.1875rem; --fs-body: .9375rem; --fs-nav: .875rem;
  --fs-eyebrow: .75rem; --fs-label: .6875rem;
}

body      { font-family: var(--font-sans); font-size: var(--fs-body); font-weight: 500; line-height: 1.5; }
.display  { font-size: var(--fs-display); font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.h1       { font-size: var(--fs-h1); font-weight: 800; line-height: 1.15; letter-spacing: -.01em; }
.kpi      { font-size: var(--fs-kpi); font-weight: 800; line-height: 1.1; letter-spacing: -.01em;
            font-variant-numeric: tabular-nums; }
.lead     { font-size: var(--fs-lead); font-weight: 500; letter-spacing: -.01em; color: var(--text-muted); }
.eyebrow  { font-size: var(--fs-eyebrow); font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }
.label    { font-size: var(--fs-label); font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.num      { font-variant-numeric: tabular-nums; text-align: right; }

@media (max-width: 768px) {
  :root { --fs-display: 3rem; --fs-h1: 1.75rem; --fs-kpi: 1.625rem; }
}
```

## Regras de uso

- Nunca usar peso 400 abaixo de 14 px em fundo escuro (fica fino demais); mínimo 500.
- Maiúsculas só em textos de até ~4 palavras (eyebrow, rótulos, cabeçalhos de tabela).
- Tracking largo (0,3 em) só na assinatura/eyebrow; nunca em rótulos de dados.
- Valores monetários no formato brasileiro (`R$ 13,8 mi` em cards; `13.833.097,93` em tabelas), sempre tabulares.
