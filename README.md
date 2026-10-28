# Gestão Operacional 2026 — Forecast e Oportunidades

Pipeline para consolidar orçamento (ORC+BG) × realizado de 2026 das Plataformas de Produção,
projetar o fechamento até dezembro e classificar cada saldo como oportunidade, compromisso
ou pressão — com justificativa, responsável, confiança e rastreabilidade até a base original.

## Estado
Fase de arquitetura. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisões D1–D5 pendentes.

## Dados
As planilhas de origem **não são versionadas**. Coloque-as localmente em `data/raw/`
(ignorado pelo Git). Testes usam apenas fixtures sintéticas em `tests/fixtures/`.

## Papéis
- Arquitetura, contratos, critérios de aceite e revisão: Claude
- Implementação: GitHub Copilot, uma tarefa por vez (T0…T8 em docs/ARCHITECTURE.md)
