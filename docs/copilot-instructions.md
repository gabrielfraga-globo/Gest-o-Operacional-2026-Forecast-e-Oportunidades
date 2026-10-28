# Instruções para o GitHub Copilot

Você é o implementador deste repositório. A arquitetura é definida em `docs/ARCHITECTURE.md` e nos ADRs
em `docs/adr/`. Cada tarefa tem um prompt com escopo fechado; implemente exatamente esse escopo.

## Regras invioláveis
- **Não mude arquitetura em silêncio.** Se a tarefa parecer exigir algo fora do escopo (nova dependência,
  nova tabela, mudança de contrato, outra pasta), pare e descreva a necessidade no PR em vez de implementar.
- **Regras de negócio vivem só em views SQL** (`db/migrations`). Python (ETL) e TypeScript (app) não
  recalculam saldo, forecast, oportunidade ou categoria.
- **Nunca versione dados reais.** Planilhas, CSVs com dados, `.env` e saídas ficam fora do Git. Testes usam
  apenas fixtures sintéticas em `etl/tests/fixtures/`.
- **Nunca escreva credenciais** em código, testes, logs ou exemplos. Use variáveis de ambiente
  (`DATABASE_URL`, `DATABASE_URL_TEST`).
- **Dinheiro:** `numeric(18,2)` no banco; `Decimal` no Python na fronteira de saída; nunca compare floats com `==`.
- **Nada de exceções engolidas.** Erros de dados devem dizer arquivo, aba, coluna e linha.

## Padrões
- Python 3.12, `uv`, tipagem completa (`mypy --strict`), `ruff` para lint e formatação.
- Funções puras no domínio; I/O só em `ingest`, `load` e `cli`.
- Migrations SQL com `dbmate`: sempre `-- migrate:up` e `-- migrate:down`; uma mudança lógica por arquivo.
- Nomes de tabelas, colunas e views em português sem acento, `snake_case`.
- Commits pequenos, mensagem no padrão Conventional Commits.

## Antes de abrir o PR
- `make check` verde.
- Testes novos para todo comportamento novo, incluindo casos de erro.
- Descrição do PR lista: tarefa (Tn), o que foi feito, o que **não** foi feito, e qualquer dúvida de escopo.
