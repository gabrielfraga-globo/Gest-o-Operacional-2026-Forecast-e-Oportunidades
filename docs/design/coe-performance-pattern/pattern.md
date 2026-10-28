# Padrão visual — COE · Performance (Plataformas Core & SI)

Referência: `performance.coe.g.globo`, capturas de 27/10/2026 de três telas:
**Home** (atalhos por área, incluindo o estado de hover), **página de área** (Financeiro Capex) e
**página de seção com navegação lateral** (Atuação → Composição).
Modelos de tela detalhados em [`references/page-templates.md`](references/page-templates.md).
Uso pretendido: telas de coleta e visual executivo do Forecast Opex 2026 (Fases 2 e 3).
Foco principal: **tipografia**. Detalhes tipográficos em [`references/typography.md`](references/typography.md).

> Este documento descreve estrutura e estilo, não dados. Valores de cor e tamanho foram estimados a partir de
> uma captura de tela e devem ser confirmados no CSS do site (ver "Incertezas").

---

## 1. Leitura geral

- **Tom:** portal interno corporativo, sóbrio, escuro, com uma única cor quente de marca e cores categóricas discretas.
- **Estrutura:** página de entrada centrada. De cima para baixo: navegação em pílula, marca grande, linha de assinatura, grade de atalhos por área, frase de missão no rodapé.
- **Densidade:** baixa. Muito espaço negativo; o conteúdo ocupa ~40% da largura e o centro vertical.
- **Hierarquia de leitura:** marca → assinatura → atalhos (ícone + rótulo colorido) → frase de rodapé → navegação.

## 2. Componentes

| Componente | Posição | Papel |
|---|---|---|
| Navegação em pílula (segmented control) | Topo, centralizada | Troca de seção. Item ativo com fundo preenchido; demais só texto |
| Marca (wordmark) | Centro, acima da metade | Identidade. Texto em peso máximo; um "o" substituído por símbolo com ponto laranja |
| Assinatura | Abaixo da marca | Nome da área em caixa alta espaçada, ladeado por dois traços laranja curtos |
| Atalho de área (tile) | Linha de 5, centralizada | Ícone de traço fino colorido dentro de um quadrado arredondado; rótulo colorido abaixo, fora do quadrado |
| Frase de missão | Rodapé, centralizada | Texto de apoio, cinza claro, peso médio |

| Fundo de área | Página de área | Fundo da página tingido com a cor da área (escurecida) e formas orgânicas grandes na cor da área saindo das bordas |
| Painel de conteúdo | Página de área e de seção | Cartão grande escuro, raio ≈ 20 px, contém título, texto, listas e sub-cards |
| Sub-card de valor | Dentro do painel | Título em MAIÚSCULAS na cor da área + linha de descrição em cinza |
| Lista numerada | Dentro do painel | Número pequeno (01, 02…) na cor da área, título em branco negrito, descrição em cinza |
| Botão de ação (CTA) | Painel lateral | Contorno 1 px na cor da área, barra vertical à esquerda, texto em branco, seta → à direita |
| Navegação lateral | Página de seção | Eyebrow "NAVEGAÇÃO"; itens numerados "01 · Nome"; ativo com texto laranja e fundo laranja translúcido |
| Card de grupo | Página de seção | Título na cor de marca, divisores 1 px entre itens; item = título negrito + descrição pequena |
| Conector | Entre cards | Seta dupla ⟷ na cor de marca |
| Carrossel de áreas | Página de área | Setas circulares nas laterais; paginação por pontos nas 5 cores de área, ativo com anel |
| Alternador de tema | Canto inferior esquerdo, fixo | Pílula com sol/lua; opção ativa em círculo laranja preenchido — **existe modo claro** |

Não aparecem na referência: tabelas, gráficos, filtros, KPIs. As receitas abaixo estendem o padrão para eles mantendo as mesmas regras (marcado como **extensão**).

## 3. Layout

- Coluna única centralizada; largura útil máxima sugerida: 1120 px para telas de dados, 720 px para telas de entrada.
- Eixo vertical com blocos separados por grandes respiros (≈ 96–160 px na referência).
- Grade de tiles: 5 colunas de mesmo tamanho, espaçamento ≈ 20 px, centralizada.
- Ordem de leitura: vertical, centralizada (não F-pattern).

## 4. Cores

| Token | Valor estimado | Uso |
|---|---|---|
| `--bg` | `#1F2329` | Fundo da página |
| `--surface` | `#252A31` | Fundo de tiles, cards, navegação |
| `--border` | `#30363F` | Contorno 1 px de tiles, cards e pílula |
| `--surface-active` | `#2E343C` | Item ativo da navegação |
| `--text` | `#F2F2F0` | Marca, títulos, valores |
| `--text-muted` | `#B5BAC2` | Frase de missão, texto de apoio |
| `--text-subtle` | `#8A9099` | Rótulos secundários (extensão) |
| `--brand` | `#F5A623` → `#F07E1B` (gradiente amarelo-laranja) | Ponto do símbolo, traços da assinatura |
| `--cat-capex` | `#5BA4D9` | Área Fin. Capex |
| `--cat-portfolio` | `#A79BE5` | Área Portfólio |
| `--cat-capacidade` | `#E6BE4A` | Área Capacidade |
| `--cat-fin-operacional` | `#E8875A` | **Área Fin. Operacional — a deste projeto** |
| `--cat-esg` | `#8CC152` | Área ESG |

| `--area-bg` | cor da área misturada ≈ 25% ao `--bg` (Capex: `#3A4B5C`) | Fundo da página de área |
| `--brand-tint` | `--brand` a ≈ 15% sobre `--bg` (`#3A2F25`) | Fundo do item ativo da navegação lateral |

Regras:
- A cor laranja de marca é **acento**: pontos, traços, títulos de cards de seção, item ativo da navegação lateral, setas conectoras, botão do tema.
- Cores categóricas identificam **área**. Na home aparecem só em ícone e rótulo; **dentro da página de uma área**, a cor da área assume o papel de acento: título da página, títulos de sub-cards, numeração de listas, contorno do CTA, formas do fundo e tingimento do fundo.
- Nunca usar duas cores de área como acento na mesma tela (exceto na paginação/atalhos que listam todas as áreas).
- O Forecast Opex pertence a **Fin. Operacional**: usar `--cat-fin-operacional` como cor da área nas telas do projeto.
- Cores semânticas (extensão, não presentes na referência): oportunidade `#7CC37F`, pressão `#E5675A`, a validar `#E6BE4A`, compromisso `#8A9099`. Sempre acompanhadas de rótulo de texto, nunca só cor.

## 5. Tipografia (resumo)

Família: **sans geométrica** com formas redondas e terminais retos, usada em toda a interface. Hierarquia feita por **peso e caixa**, não por troca de família.

| Nível | Tamanho estimado | Peso | Caixa / espaçamento | Cor |
|---|---|---|---|---|
| Marca / display | 72–88 px | 800–900 | Normal; tracking levemente negativo (≈ −0,02 em) | `--text` |
| Título de página (extensão) | 32–40 px | 800 | Normal; tracking −0,01 em | `--text` |
| Valor de KPI (extensão) | 28–36 px | 800, numerais tabulares | Normal | `--text` |
| Assinatura / eyebrow | 12–13 px | 700 | MAIÚSCULAS; tracking largo ≈ 0,3 em | `--text` |
| Navegação | 13–14 px | 700 | Normal | `--text` (ativo) / `--text-muted` |
| Rótulo de tile / cabeçalho de tabela | 10–11 px | 800 | MAIÚSCULAS; tracking ≈ 0,04 em | Cor da categoria / `--text-subtle` |
| Título de área | 56–64 px, 2 linhas | 800 | Normal; tracking −0,02 em | Cor da área |
| Lead da área | 22–26 px | 400 | Normal; line-height ≈ 1,5 | `--text` levemente apagado |
| Título de seção | 26–28 px | 800 | Normal; tracking −0,02 em | `--text` ou cor da área |
| Título de sub-card | 15–17 px | 800 | MAIÚSCULAS sem tracking extra | Cor da área |
| Título de item de lista/card | 15–17 px | 700–800 | Normal | `--text` |
| Número de lista | 12–13 px | 500 | Normal | Cor da área |
| Navegação lateral | 13 px | 700 | "01 · Nome" | `--text` / ativo `--brand` |
| Corpo | 15–16 px | 400–500 | Normal | `--text` |
| Descrição de item | 13–15 px | 400 | Normal | `--text-muted` |
| Frase de apoio | 18–20 px | 500 | Normal; tracking levemente negativo | `--text-muted` |

Observação: os eyebrows dentro de painéis ("VALOR", "COMO ATUAMOS", "NAVEGAÇÃO") usam o mesmo estilo da assinatura em tamanho menor (10–11 px, 700, tracking ≈ 0,25 em, `--text-muted`).

Detalhes, fontes candidatas e CSS em [`references/typography.md`](references/typography.md).

## 6. Receitas de componentes

**Navegação em pílula**
- Contêiner com raio total, contorno 1 px `--border`, preenchimento interno ≈ 6 px.
- Itens com raio total, padding ≈ 8 × 14 px, peso 700. Ativo: fundo `--surface-active`.

**Tile de área / atalho**
- Quadrado ≈ 120 px, raio ≈ 16 px, fundo `--surface`, contorno 1 px `--border`.
- Ícone de traço (≈ 1,75 px), 28 px, centralizado, na cor da categoria.
- Rótulo **fora** do quadrado, 12 px abaixo, maiúsculas, 800, cor da categoria.
- **Hover (observado):** contorno passa para a cor da categoria, o tile sobe levemente (≈ 4 px) e cresce um pouco; o rótulo acompanha. **O ponto do símbolo da marca muda para a cor da área sob o cursor** e o anel ganha um arco nessa cor — a marca "responde" à área escolhida.

**Navegação lateral de seção**
- Coluna fixa ≈ 220 px com divisor vertical 1 px `--border`.
- Eyebrow "NAVEGAÇÃO"; itens "01 · Nome", 13 px, 700, padding ≈ 8 × 10 px, raio 8 px.
- Ativo: texto `--brand`, fundo `--brand-tint`. Sem ícones.

**Painel de área (página de detalhe)**
- Duas colunas de painéis ≈ 60/40, raio ≈ 20 px, fundo `--surface`, sobre fundo `--area-bg` com formas orgânicas.
- Coluna principal: título de área (2 linhas) → lead → eyebrow → lista numerada; à direita, eyebrow + pilha de sub-cards.
- Painel lateral: título de seção na cor da área → texto → CTA com contorno.
- Navegação entre áreas: setas circulares nas bordas e pontos coloridos embaixo.

**Card de grupo (página de seção)**
- Título na cor de marca; itens separados por divisores 1 px; cada item com título negrito e descrição de uma linha.
- Dois cards lado a lado podem ser ligados por um conector ⟷ na cor de marca quando há relação entre eles.

**Card de KPI (extensão)**
- Mesmo fundo, raio e contorno do tile.
- Ordem: eyebrow (maiúsculas, 11 px, `--text-subtle`) → valor (32 px, 800, numerais tabulares) → linha de contexto (13 px, `--text-muted`).
- Sem ícones grandes; no máximo um ponto de 6 px na cor semântica ao lado do eyebrow.

**Tabela (extensão)**
- Sem zebra; linhas separadas por 1 px `--border`.
- Cabeçalho: 11 px, 800, maiúsculas, `--text-subtle`. Células: 14 px, 500. Números à direita, numerais tabulares.
- Categoria da linha como pílula pequena: texto 11 px 700 na cor semântica, fundo dessa cor a 12%.
- Ação inline (editar) aparece no hover da linha e sempre no foco de teclado.

**Gráfico (extensão)**
- Barras horizontais para comparar N4; cascata para ORC+BG → Realizado → Compromissos → Pressões → Oportunidade.
- Eixos e grades em `--border`; rótulos 11–12 px `--text-subtle`; uma cor por série com significado (semânticas acima).

**Formulário de edição (extensão)**
- Campos com fundo `--bg`, contorno `--border`, foco com contorno `--cat-fin-operacional`.
- Rótulos acima do campo: 12 px, 700, `--text-muted`. Botão primário: fundo `--brand`, texto `#1F2329`, 700.

## 7. Estados

| Estado | Comportamento |
|---|---|
| Carregando | Esqueletos nas mesmas dimensões dos tiles/cards, fundo `--surface` com brilho suave; nunca spinner sozinho na página |
| Vazio | Frase de apoio centralizada (estilo da frase de missão) + uma ação primária |
| Erro | Card com borda esquerda 3 px pressão, título curto e ação "tentar de novo" |
| Poucos itens | Grade continua centralizada; não esticar cards para preencher |
| Salvando (formulário) | Botão em estado ocupado; campos travados; confirmação discreta abaixo do formulário |

## 8. Responsividade e acessibilidade

- **Tema claro e escuro:** o site tem alternador de tema. Todos os tokens de cor precisam de par claro; o escuro é o padrão. Valores do tema claro não foram capturados — confirmar no site.
- < 768 px: marca cai para 44–52 px; navegação lateral vira menu suspenso no topo; painéis de área empilham (principal primeiro); tiles passam para 3 colunas e depois 2; navegação vira rolagem horizontal mantendo a pílula.
- Tabelas em telas estreitas viram lista de cartões (N4/projeto no topo, valores em pares rótulo-valor).
- Contraste: `--text` e `--text-muted` sobre `--bg` passam AA. **Rótulos de 10–11 px na cor da categoria precisam ser verificados**: os tons amarelo e laranja passam; o azul e o roxo ficam próximos do limite — em textos de dado, usar a cor da categoria só no ícone e o rótulo em `--text-muted`.
- Alvos de toque ≥ 44 px (os tiles já atendem; itens da pílula precisam de altura mínima).
- Foco de teclado visível: contorno 2 px `--brand` com afastamento de 2 px.
- Ícones decorativos com `aria-hidden`; tiles com nome acessível igual ao rótulo; gráficos com resumo textual.

## 9. Camada visual × camada de dados

| Bloco | Fixo no padrão | Variável (dados) |
|---|---|---|
| Navegação | Forma, tipografia, comportamento | Lista de seções |
| Marca/assinatura | Estilo | Nome da área/produto |
| Tiles | Tamanho, raio, ícone de traço, posição do rótulo | Áreas, ícones, cores de categoria |
| Cards de KPI | Ordem eyebrow → valor → contexto | ORC+BG, realizado, saldo, forecast, oportunidade |
| Tabela | Estilo de cabeçalho, alinhamento, pílula de categoria | Linhas N4 × projeto e colunas de valores |

## 10. Conexão com dados reais

Neste projeto, os blocos de dados leem as views do Postgres (Neon) definidas no ADR-004:
`vw_resumo_n4` (cards e barras por N4), `vw_forecast` (tabela e formulário), `vw_reconciliacao` (KPIs de topo).
O padrão em si é agnóstico: os mesmos blocos funcionam com API REST, CSV/Excel, SharePoint, SQL, BigQuery ou Power BI.

## 11. Incertezas

- **Família tipográfica exata não é identificável pela captura.** As formas sugerem uma sans geométrica de peso alto
  (candidatas: Gilroy, Satoshi, Outfit, Plus Jakarta Sans). Confirmar no site: DevTools → Console →
  `getComputedStyle(document.querySelector('h1, header, body')).fontFamily`.
- Cores estimadas a partir de imagem comprimida; confirmar no CSS (variáveis em `:root`).
- Hover dos tiles foi observado; clique, transições e tempo de animação não.
- A paleta do tema claro não foi capturada.
- O símbolo do "o" com ponto laranja é marca da área: usar apenas no cabeçalho, não recriar como ícone genérico.

## 12. Prompt de reuso

```
Crie a tela [nome da tela] do Forecast Opex 2026 seguindo docs/design/coe-performance-pattern/pattern.md
e references/typography.md:
- Fundo escuro (--bg), cards em --surface com contorno 1 px e raio 16 px
- Hierarquia tipográfica da tabela da seção 5 (display 800, eyebrow em maiúsculas espaçadas, rótulos 11 px 800)
- Cor de área: --cat-fin-operacional (é a página da área Fin. Operacional: título, sub-cards, numeração e CTA nessa cor; fundo --area-bg); laranja de marca nos demais acentos
- Estrutura de página conforme references/page-templates.md (escolha: página de área ou página de seção com navegação lateral)
- Tema escuro como padrão, com alternador de tema no canto inferior esquerdo
- Blocos: [ex.: 5 cards de KPI, barras por N4, tabela N4 × projeto com edição inline]
- Estados de carregando, vazio e erro conforme a seção 7
- Dados das views vw_reconciliacao, vw_resumo_n4 e vw_forecast; usar dados mockados com o mesmo formato até a API existir
```
