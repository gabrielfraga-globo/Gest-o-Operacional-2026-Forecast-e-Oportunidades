# Forecast & Oportunidades Opex 2026 — Plataformas de Produção
## Revisão arquitetural (v0.3 — 27/10/2026)

Papel: Claude = arquiteto/revisor · GitHub Copilot = implementador.
Status: **v0.3 — ADR-004 aceito (Neon + Vercel). Fase 1 (interpretar, limpar, carregar) em andamento: T0 liberada; D1, D3, D4 bloqueiam T2, T3 e T7.**

---

## 0. Escopo do que foi investigado

| Artefato | Encontrado? |
|---|---|
| Repositório de código, README, CLAUDE.md, AGENTS.md, copilot-instructions.md | **Não** — nada no workspace, no Project nem em pasta conectada |
| package.json / pyproject / requirements / CI / migrations / testes / ADRs | **Não** |
| `Resumo` (doc do Project) | Sim — define regras de negócio e números de controle |
| `Oportunidades Opex 2026 Plataformas de Produção.xlsx` | Sim — base unificada ORC+BG × REAL (14.613 linhas) + aba `Análise` |
| `Orçamento 2026 - Plataformas de Produção áreas.xlsx` | Sim — base de orçamento 2026 por CC/projeto + 10 abas ocultas de trabalho |

**Conclusão:** hoje o "sistema" é um conjunto de planilhas com tabelas dinâmicas e valores digitados. Não há código para revisar; a revisão abaixo trata as planilhas como o sistema atual.

---

## 1. CURRENT STATE

### 1.1 Componentes
1. **Base unificada** (`Oportunidades…xlsx › Base`): fato mensal, 45 colunas.
   - `CEN2` ∈ {ORC+BG, REAL}; `Cenário` com 13 valores (ORC_ORIGINAL, ORC_REV_MAR/MAI/JUL/STB, BG_MAR/MAI/JUN/JUL/AGO/OUT/STB, REALIZADO).
   - Origens: `Acompanhamento_PLAT_CORE.xlsx` (orçamento) e `GL_Realizado` (contábil).
   - Hierarquia N1→N5 (N4 tem 8 valores, N5 29), Centro de Custo (62), Projeto (250), Finalidade, Fornecedor, Conta, Grupo/Subgrupo.
   - Rastreabilidade do realizado: `DS_LINHA_LANCTO_CONTABIL`, `OC/RC`, `DT_CONTABILIZACAO`.
2. **Aba `Análise`**: pivot ORC+BG × REAL por N4 + lista de 6 oportunidades com valores **digitados** (≈ R$ 5,36 mi) e observações livres.
3. **`Orçamento 2026…xlsx`**: base de orçamento original por CC/projeto/fornecedor/mês, com abas ocultas de reorganização de CC ("Centro de Custo Futuro", "Novo Projeto"), PPM IDs e rastreio por aprovador.

### 1.2 Fluxo de dados atual
```
Acompanhamento_PLAT_CORE (orç + revisões + BGs) ┐
                                                 ├─► Base (cola manual) ─► Pivots ─► Análise (valores digitados)
GL_Realizado (contábil)                          ┘
```
Sem pipeline, sem versionamento, sem testes, sem trilha de quem alterou o quê.

### 1.3 Reconciliação dos números de controle (executada)

| Controle (Resumo) | Recalculado da Base | Status |
|---|---|---|
| ORC+BG R$ 68.623.870 | R$ 68.623.870 | ✅ |
| Realizado R$ 54.790.771 | R$ 54.790.771 | ✅ |
| Saldo R$ 13.833.099 | R$ 13.833.099 | ✅ |
| Utilização 79,8% | 79,8% | ✅ |
| Real sem orçamento R$ 504.391 | **Não reproduzível** — N4+Projeto dá R$ 935.757; Projeto dá R$ 933.917; nenhum grão testado (1 a 3 dimensões entre N4, N5, CC, Projeto, Finalidade, Fornecedor, Grupo, Conta) chega a 504.391 | ❌ |

Saldo por N4: Pós-Prod. e Design 6,29 mi · Metadados e Mídias 1,88 mi · Pré-Produção 1,50 mi · Publishing 1,47 mi · Plataformas de Produção 1,37 mi · Sust. RJ 1,23 mi · Sust. SP/Reg. 0,13 mi · Captação e Produção **−0,03 mi**.

---

## 2. GAP ANALYSIS

### 2.1 O que está correto
- Base única com ORC+BG e REAL no mesmo grão e mesma hierarquia → comparação direta é possível.
- Totais batem com o Resumo (4 de 5 controles).
- Realizado tem chaves de auditoria (lançamento, OC, data) — base boa para rastreabilidade.
- Regra de negócio do Resumo está correta: saldo ≠ economia.

### 2.2 Defeitos e riscos (ordenados por severidade)

| # | Achado | Evidência | Classificação | Impacto |
|---|---|---|---|---|
| G1 | **"Real sem orçamento" sem definição reproduzível** | 504.391 não sai de nenhum grão testado | Defeito de especificação | Número executivo sem rastreabilidade — viola requisito 6 |
| G2 | **Saldo líquido esconde pressões** | No grão N4+Projeto: 119 linhas com saldo positivo = **R$ 17,54 mi**; 147 linhas estouradas = **−R$ 3,71 mi** | Defeito de modelagem | A "oportunidade" bruta é 17,5 mi, mas 3,7 mi já estão consumindo; apresentar 13,8 mi esconde onde há estouro |
| G3 | **Faseamento mensal do orçamento é inutilizável** | ORC+BG de Fevereiro = −R$ 17,3 mi; Janeiro = +R$ 27,3 mi (revisões lançadas no mês da revisão, não no mês da despesa) | Decisão implícita / defeito | Qualquer "orçado restante Nov–Dez" mensal estará errado; forecast precisa partir do anual |
| G4 | **Realizado com estornos relevantes** | 581 linhas negativas somando **−R$ 37,2 mi** (bruto positivo ≈ 92 mi) | A investigar | Provisões/estornos entre meses podem distorcer o run-rate usado para prever Nov–Dez |
| G5 | **Outubro parcial** | Lançamentos até 27/10 | Esperado, mas não sinalizado | Forecast precisa tratar Out como mês aberto |
| G6 | **Oportunidades digitadas** | 6 valores fixos na `Análise` (≈ 5,36 mi), sem vínculo a linhas da base, sem responsável/confiança/data | Defeito de processo | Não auditável; não separa oportunidade × compromisso × pressão |
| G7 | **Linhas órfãs / inválidas** | 2 linhas ORC sem `Nome da Origem` (**−R$ 373 mil**, Dezembro, Outsourcing); 18 linhas com `Valor` nulo | Defeito de dados | Somas silenciosamente ignoram ou incluem lixo |
| G8 | **Não há chave única** | `Índice` tem 391 duplicatas; `ID` nulo em 296 linhas ORC e em todo o REAL | Defeito de dados | Não dá para referenciar uma linha de forma estável (necessário para justificativas) |
| G9 | **Colunas desalinhadas/vazias** | `ID Contrato / Acordo` contém 58.333,33 (valor monetário); `Racional`, `Vigência`, `% reaj.`, `Elegível IFRS` 100% vazias | Dívida técnica | Campos prometidos não existem; possível deslocamento de coluna na carga |
| G10 | **Duas fontes de orçamento sem reconciliação** | `Orçamento…xlsx` (base própria, CC "futuros") × `Base` (Acompanhamento_PLAT_CORE) | Risco | Divergência de CC/projeto entre arquivos; não está claro qual é a fonte da verdade |
| G11 | **Nomes de projeto longos e sem dicionário** | 250 projetos, até 112 caracteres | Requisito 2 não atendido | Visão de uma tela ilegível |
| G12 | **Sem versionamento/snapshot** | Planilha sobrescrita a cada rodada | Risco | Impossível comparar forecast da reunião N com N−1 |

---

## 3. TARGET ARCHITECTURE (v0.3 — ADR-004)

### 3.1 Princípios
- **Duas fontes, papéis distintos, sem sobreposição:**
  - a planilha (formulário de acompanhamento) é a fonte do **orçamento e do realizado** — importada, nunca editada pelo sistema;
  - o **Neon é o sistema de registro do futuro** (previsões, justificativas, responsáveis) — nenhuma planilha guarda forecast.
- **Importação idempotente e auditável:** cada carga é um `import_run` com hash do arquivo; recarregar o mesmo arquivo não duplica nada.
- **Regras de negócio em um só lugar: views SQL no Postgres.** ETL (Python) e app (TypeScript) apenas leem as views; nenhuma das duas linguagens recalcula saldo, forecast ou categoria.
- **Rastreabilidade:** toda linha agregada chega às linhas da base original por `row_key`.
- **Reconciliação é quality gate:** a carga só é marcada `ok` se os totais baterem com os controles.
- **Nenhuma rota pública sem login** quando o app existir (Fase 2).

### 3.2 Fases

| Fase | Entrega | Quem |
|---|---|---|
| **1. Interpretar, limpar e carregar** | ETL Python local → Neon, com modelo, views, reconciliação e relatório de qualidade | Copilot implementa, Claude revisa |
| 2. Coleta | App Next.js na Vercel, login obrigatório, edição do futuro por projeto gravando no Neon | Copilot implementa, Claude revisa |
| 3. Visual final | Tela executiva de uma página lendo as views | Copilot implementa, Claude revisa |

### 3.3 Componentes (Fase 1)

```
data/raw/*.xlsx (local, fora do Git)
   │
   ▼
etl/  (Python, roda no notebook)
 [1] ingest       lê aba Base → DataFrame tipado + row_key + hash do arquivo
 [2] validate     schema + regras de qualidade (ERROR/WARN) → dq_report.md
 [3] normalize    nomes curtos (config/project_aliases.csv), meses → int, sinais
 [4] load         abre import_run, carrega staging, faz upsert em fato_lancamento,
                  atualiza dimensões e forecast_linha — tudo numa transação
 [5] reconcile    compara vw_reconciliacao com config/controls.yaml → status do import_run
   │
   ▼
Neon Postgres  (branch dev para testes, branch main para produção)
 db/migrations/*.sql  (dbmate)
 tabelas + views de regra de negócio
```

### 3.4 Modelo de dados (Postgres)

**Tabelas**

| Tabela | Grão / chave | Conteúdo |
|---|---|---|
| `import_run` | `id` | arquivo, sha256, carregado_em, linhas_lidas, linhas_validas, totais, status (`loading`/`ok`/`failed`), relatório DQ |
| `dim_n4` | `n4_id` | nome original, nome curto |
| `dim_projeto` | `projeto_id` | código completo, nome curto (≤ 30 caracteres) |
| `fato_lancamento` | `row_key` | cen2, cenário, n4_id, n5, cc, projeto_id, finalidade, fornecedor, conta, grupo, mês, valor (`numeric(18,2)`), oc_rc, dt_contab, lançamento, `import_run_id` |
| `forecast_linha` | `linha_id`; único (n4_id, projeto_id) | unidade de coleta; responsável; ativo |
| `forecast_input` | `linha_id` | previsao_futura, classificacao, justificativa, confianca, proxima_acao, atualizado_por, atualizado_em, `versao` (controle otimista) |
| `forecast_input_hist` | `id` | cópia de cada versão anterior (trigger), para auditoria |

**Enums**: `cen2` (ORC_BG, REAL) · `classificacao` (COMPROMISSO, POSTERGACAO, CANCELAMENTO, ECONOMIA, A_VALIDAR) · `confianca` (ALTA, MEDIA, BAIXA) · `categoria` (OPORTUNIDADE, COMPROMISSO, PRESSAO, A_VALIDAR).

**Views (regras de negócio)**

| View | Regra |
|---|---|
| `vw_saldo_linha` | por (n4, projeto): orc_bg, realizado, saldo_atual = orc_bg − realizado, `source_count` |
| `vw_saldo_reagrupado` | aplica a regra "INDIRETO — REAL SEM ORÇAMENTO" (grão definido em D1) |
| `vw_forecast` | junta `forecast_input`: forecast_fechamento = realizado + previsao_futura; oportunidade_ajustada = orc_bg − forecast_fechamento; categoria (ver 3.5) |
| `vw_resumo_n4` | totais por N4: bruto positivo, pressões, líquido, forecast, oportunidade ajustada, % com input |
| `vw_reconciliacao` | totais do último `import_run` para comparar com os controles |

### 3.5 Regras de negócio
- **R1 — Real sem orçamento:** linha com orc_bg = 0 e realizado ≠ 0 é reagrupada em `INDIRETO — REAL SEM ORÇAMENTO` dentro do seu N4, mantendo rastreabilidade (grão depende de D1).
- **R2 — Saldo bruto vs líquido:** a visão mostra bruto positivo, pressões e líquido separados.
- **R3 — Forecast anual:** previsão futura é um valor total até dezembro por linha; o faseamento mensal do orçamento não é usado (contém revisões lançadas fora do mês).
- **R4 — Categoria:**
  - sem input ou `classificacao = A_VALIDAR` → `A_VALIDAR`;
  - oportunidade_ajustada < −1 → `PRESSAO`;
  - |oportunidade_ajustada| ≤ 1 → `COMPROMISSO`;
  - oportunidade_ajustada > 1 e input completo → `OPORTUNIDADE`.
- **R5 — Input completo** = previsao_futura ≥ 0, justificativa, responsável, confiança e próxima ação preenchidos.

### 3.6 Estratégia de erros
- Erro de schema/carga → transação desfeita, `import_run.status = failed`, exit ≠ 0 com aba/coluna/linha.
- Regras de qualidade → `ERROR` aborta; `WARN` segue e entra no relatório.
- Reconciliação divergente > R$ 1 → `failed`.
- Recarga do mesmo arquivo (mesmo sha256) → nada muda; mensagem "já carregado".

### 3.7 Observabilidade
- `import_run` é o log de cargas (consultável).
- `dq_report.md` por carga em `out/`.
- Logs estruturados (JSON) do ETL com etapa, contagens e totais.

### 3.8 Segurança (condições do ADR-004)
- Repositório **privado**.
- Projeto Neon dedicado; `DATABASE_URL` só em `.env` local (fora do Git) e nas variáveis da Vercel; usuário de aplicação com permissões mínimas (sem DDL) separado do usuário de migração.
- E-mails de aprovadores **não** são carregados: o responsável é identificado por nome em `config/responsaveis.csv`.
- Fase 2 só vai ao ar com login obrigatório em todas as rotas.
- Validação com a área de segurança/compliance sobre hospedar valores contratuais em Neon/Vercel registrada como risco aceito pelo dono do produto.

### 3.9 Testes
- **Unitários (Python):** ingest, validate, normalize com fixtures sintéticas.
- **Integração (Postgres real):** migrations + carga de fixture + asserts nas views (CI com serviço `postgres:16`; local com Docker ou branch dev do Neon).
- **Propriedades:** soma de `vw_saldo_linha` = soma de `fato_lancamento` por cen2; cada `row_key` em exatamente uma linha; recarga idempotente.
- **Golden:** reconciliação com os controles (ORC+BG 68.623.870; Real 54.790.771; Saldo 13.833.099; Real sem orçamento conforme D1).

### 3.10 Stack e layout
Python 3.12 (uv) · pandas · pandera · psycopg 3 · pytest · ruff · mypy · dbmate (migrations SQL) · Postgres 16 (Neon) · Fase 2: Next.js + TypeScript na Vercel.

```
/
├── db/migrations/            # SQL (dbmate) — tabelas, enums, views
├── etl/
│   ├── pyproject.toml
│   ├── src/opex_etl/{domain,ingest,validate,normalize,load,reconcile,cli}.py
│   └── tests/{unit,integration,fixtures}/
├── config/{project_aliases.csv,responsaveis.csv,controls.yaml}
├── app/                      # Fase 2
├── docs/{ARCHITECTURE.md,adr/}
├── .github/{workflows/ci.yml,copilot-instructions.md}
├── .env.example
└── data/ out/                # ignorados pelo Git
```

---

## 4. DECISÕES

| ID | Pergunta | Status |
|---|---|---|
| D1 | Qual grão/regra gera R$ 504.391 de "real sem orçamento"? | **Aberta** — recomendação: N4 + Projeto (R$ 935.757) e atualizar o controle. Bloqueia T7 |
| D2 | Repositório | ✅ Repositório novo, privado |
| D3 | Fonte da verdade do orçamento | **Aberta** — recomendação: aba `Base` (Acompanhamento_PLAT_CORE). Bloqueia T2 |
| D4 | 2 linhas sem origem (−R$ 373 mil) e 18 valores nulos | **Aberta** — recomendação: manter as 2 com WARN; nulos = 0 com WARN. Bloqueia T3 |
| D5 | Canal de coleta | ✅ ADR-004: Neon + app na Vercel |
| D6 | Autenticação da Fase 2 | **Aberta** — decidir antes da Fase 2 |
| D7 | Linha sem previsão preenchida | **Adotada no playbook:** saldo positivo assumido como realizado; categoria A_VALIDAR |

---

## 5. IMPLEMENTATION PLAN — Fase 1

> **Operacional:** os prompts executáveis, a ordem final (T5 schema → T6 views → T7 carga+reconciliação → T8 CLI) e as decisões D1/D3/D4/D7 embutidas estão em `docs/PLAYBOOK_COPILOT.md`. Em caso de divergência, o playbook prevalece para execução; esta seção descreve a intenção.

Ordem: T0 → T1 → … → T8. Nenhuma tarefa começa sem a anterior aprovada.

### T0 — Esqueleto do monorepo e quality gates  ✅ liberada
- **Objetivo:** estrutura de pastas, projeto Python do ETL, ferramenta de migrations e CI rodando, sem lógica de negócio.
- **Arquivos:** `etl/pyproject.toml`, `etl/src/opex_etl/__init__.py`, `etl/tests/test_smoke.py`, `db/migrations/.gitkeep`, `.github/workflows/ci.yml`, `.env.example` (tarefas via poethepoet no `pyproject.toml`, multiplataforma — o notebook é Windows, sem `make`).
- **Restrições:** não criar tabelas, views nem módulos de negócio; não alterar `docs/`, `README.md`, `.gitignore` nem `.github/copilot-instructions.md`.
- **Aceite:** `uv run poe check` (dentro de `etl/`) passa localmente no Windows e no CI; CI sobe `postgres:16` e roda `dbmate up` sem erro (sem migrations ainda).
- **Validação:** `cd etl && uv run poe check`
- **Prompt Copilot:** ver seção 5.1.

### T1 — Domínio e contratos (Python)
Enums e tipos espelhando os enums do banco; `mes_para_int`; constantes de colunas da aba Base. Aceite: cobre todos os valores observados; erros explícitos.

### T2 — Ingestão com row_key (depende de D3)
Lê a aba `Base` (cabeçalho na linha 2), renomeia colunas para snake_case, gera `row_key` estável e única (inclui ordem de ocorrência para duplicatas), calcula sha256 do arquivo. Aceite: 14.613 linhas; chaves únicas; determinístico.

### T3 — Validação de qualidade (depende de D4)
Schema pandera + regras ERROR/WARN + `dq_report.md`. Aceite: detecta na base real os 18 nulos, as 2 linhas sem origem e a coluna `ID Contrato / Acordo` com valor monetário.

### T4 — Normalização e nomes curtos
`config/project_aliases.csv` (250 projetos) e `config/responsaveis.csv`; projeto sem alias = ERROR listando faltantes. Aceite: aliases únicos, ≤ 30 caracteres.

### T5 — Schema do banco (migrations)
Tabelas, enums, índices, trigger de histórico de `forecast_input`, usuário de aplicação sem DDL. Aceite: `dbmate up` e `dbmate rollback` funcionam; testes de integração verificam constraints.

### T6 — Carga idempotente
`opex-etl load <arquivo>`: abre `import_run`, carrega em staging, faz upsert, cria `forecast_linha` novas, nunca apaga `forecast_input`. Aceite: recarga do mesmo arquivo não altera nada; linha que some da base é marcada inativa, não apagada.

### T7 — Views de regra de negócio (depende de D1)
`vw_saldo_linha`, `vw_saldo_reagrupado`, `vw_forecast`, `vw_resumo_n4`, `vw_reconciliacao`. Aceite: testes de integração cobrindo R1–R5; bruto positivo 17,54 mi e pressões −3,71 mi reproduzidos no grão N4 + Projeto.

### T8 — Reconciliação e CLI final
`opex-etl reconcile` compara com `config/controls.yaml` e fecha o `import_run`. Aceite: divergência > R$ 1 marca `failed` com diferença por controle.

Fases 2 e 3 serão detalhadas após o aceite da T8 e a decisão D6.

### 5.1 Prompt para o Copilot — T0

> **Contexto:** monorepo de forecast Opex 2026. Leia `.github/copilot-instructions.md` e `docs/ARCHITECTURE.md` (seções 3.10 e 5/T0) antes de começar. Esta tarefa cria **apenas** a estrutura e os quality gates.
>
> **Faça:**
> 1. `etl/pyproject.toml` (gerenciado por `uv`, build backend hatchling, pacote `opex_etl` em `etl/src/`), Python `>=3.12`. Dependências: `pandas`, `openpyxl`, `pandera`, `psycopg[binary]>=3.2`, `pyyaml`, `python-dotenv`. Dev: `pytest`, `pytest-cov`, `ruff`, `mypy`, `pandas-stubs`, `types-PyYAML`, `poethepoet`.
> 2. Configuração do ruff (line-length 100; regras `E,F,I,B,UP,SIM`) e do mypy (`strict = true` para `opex_etl`) dentro do `pyproject.toml`.
> 3. `etl/src/opex_etl/__init__.py` com `__version__ = "0.1.0"` e `etl/tests/test_smoke.py` que importa o pacote e confere a versão.
> 4. `db/migrations/.gitkeep`.
> 5. `.env.example` com `DATABASE_URL=postgres://user:pass@host/db?sslmode=require` e `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/opex_test?sslmode=disable`, comentados.
> 6. Tarefas do poethepoet em `[tool.poe.tasks]` no `etl/pyproject.toml`: `lint` (`ruff check .` e `ruff format --check .`), `typecheck` (`mypy src`), `test` (`pytest -q --cov=opex_etl`), `check` (sequência lint → typecheck → test) e `migrate` (`dbmate --migrations-dir ../db/migrations up`). **Não crie Makefile**: o ambiente de desenvolvimento é Windows.
> 7. `.github/workflows/ci.yml`: gatilho em push e pull_request; serviço `postgres:16` com healthcheck; instala `uv` e `dbmate`; roda `dbmate --url $DATABASE_URL_TEST --migrations-dir db/migrations --no-dump-schema up` e depois `uv sync` e `uv run poe check` dentro de `etl/`.
>
> **Não faça:** nenhuma tabela, view, módulo de domínio ou leitura de planilha; não altere `docs/`, `README.md`, `.gitignore` nem `.github/copilot-instructions.md`; não adicione dependências além das listadas.
>
> **Pronto quando:** `cd etl && uv run poe check` passa no Windows e o workflow fica verde.

---

## 6. Protocolo de revisão por tarefa

Para cada entrega do Copilot: ler o diff inteiro → rodar `uv run poe check` → checar critérios de aceite e restrições → verificar mudanças fora do escopo → classificar **APPROVED / APPROVED WITH NOTES / CHANGES REQUIRED / BLOCKED** → se CHANGES REQUIRED, emitir prompt de correção objetivo.

## 7. Registro de decisões (ADR)
- ADR-001 (proposto): forecast anual por linha, não mensal (faseamento do orçamento contém revisões fora do mês).
- ADR-002 (proposto): visão executiva separa saldo bruto, pressões e líquido.
- ADR-003: canal de entrada via SharePoint + Power Apps. *Status: substituído pelo ADR-004.*
- ADR-004: Neon como sistema de registro do futuro; regras de negócio em views SQL; ETL Python local; coleta e visual em Next.js na Vercel. *Status: aceito com condições de segurança.*
