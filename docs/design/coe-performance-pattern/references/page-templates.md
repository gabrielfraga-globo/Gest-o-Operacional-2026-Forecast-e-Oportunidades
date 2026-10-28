# Modelos de página

Três modelos observados no site e como cada um se aplica ao Forecast Opex 2026.

## A. Página de entrada (Home)

```
┌──────────────────────── [ pílula: Home · Ferramentas · Atuação ] ────────────────────────┐
│                                                                                            │
│                          MARCA (display 800, ponto do "o" na cor da área)                  │
│                          —  ASSINATURA EM MAIÚSCULAS ESPAÇADAS  —                          │
│                                                                                            │
│                 [tile] [tile] [tile] [tile] [tile]     ← 5 áreas, ícone + rótulo colorido  │
│                                                                                            │
│                          frase de apoio (lead, cinza)                                      │
│ (☀/☾)                                                                                      │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```
Uso no projeto: não há home própria; o forecast entra como destino do tile **Fin. Operacional**.

## B. Página de área (detalhe)

```
┌ fundo --area-bg com formas orgânicas na cor da área ───────────────────────────────────────┐
│                      [ pílula de navegação ]                                               │
│ (‹) ┌──────────── painel principal (≈60%) ─────────────┐ ┌──── painel lateral (≈40%) ────┐ (›)│
│     │ Título da área (2 linhas, cor da área)  │ EYEBROW │ │ Título de seção (cor da área) │    │
│     │ Lead (24 px)                            │[subcard]│ │ texto de apoio                │    │
│     │                                         │[subcard]│ │ [ | CTA com contorno      → ] │    │
│     │ EYEBROW                                 │[subcard]│ │                               │    │
│     │ 01 Título  / descrição                  │         │ │                               │    │
│     │ 02 Título  / descrição                  │         │ │                               │    │
│     └──────────────────────────────────────────────────┘ └───────────────────────────────┘    │
│ (☀/☾)                       ( ● ● ● ● ● )  paginação nas cores das áreas                    │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Aplicação — Visual executivo do Forecast (Fase 3)**, uma tela para a reunião:
- Painel principal:
  - título "Forecast Opex 2026" na cor Fin. Operacional;
  - lead com a frase-síntese da rodada (ex.: "R$ 13,8 mi ainda não realizados; R$ X mi já justificados");
  - linha de 5 cards de KPI (ORC+BG, Realizado, Saldo, Forecast de fechamento, Oportunidade ajustada);
  - barras horizontais por N4 separando bruto positivo e pressões.
- Painel lateral:
  - eyebrow "STATUS DA COLETA" com % de linhas com input por N4 (lista numerada);
  - sub-cards de categoria (Oportunidade, Compromisso, Pressão, A validar) com valor e quantidade;
  - CTA "Abrir coleta →" para o modelo C.
- Fonte: `vw_reconciliacao`, `vw_resumo_n4`, `vw_forecast`.

## C. Página de seção com navegação lateral

```
┌──────────────┬──────────────────── [ pílula de navegação ] ─────────────────────────────────┐
│ NAVEGAÇÃO    │                                                                              │
│ 01 · Item    │        Título de seção (28 px, 800)                                          │
│ 02 · Ativo ◀ │        ┌──── card de grupo ────┐   ⟷   ┌──── card de grupo ────┐             │
│ 03 · Item    │        │ Título (marca)        │       │ Título (marca)        │             │
│ 04 · Item    │        │ ───────────────────── │       │ ───────────────────── │             │
│              │        │ Item / descrição      │       │ Item                  │             │
│ (☀/☾)        │        └───────────────────────┘       └───────────────────────┘             │
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

**Aplicação — Coleta do forecast (Fase 2):**
- Navegação lateral = os 8 N4 ("01 · Pós-Prod. e Design" …), com contador de pendências à direita do nome.
- Área principal:
  - título do N4 e linha-resumo (ORC+BG, realizado, saldo);
  - tabela N4 × projeto (cabeçalho em rótulo 11 px, números tabulares);
  - pílula de categoria por linha e ação "editar" que abre o formulário no lugar da linha (ou num painel lateral).
- Formulário com os campos do contrato `forecast_input`, mostrando uma prévia do forecast rotulada como "prévia". O número oficial vem da view.
- Fonte: `vw_forecast` filtrada por N4; gravação somente em `forecast_input`.
