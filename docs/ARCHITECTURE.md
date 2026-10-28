# Forecast & Oportunidades Opex 2026 — Plataformas de Produção
## Revisão arquitetural (v0.1 — 27/10/2026)

Papel: Claude = arquiteto/revisor · GitHub Copilot = implementador.
Status: **v0.2 — canal de entrada decidido (ADR-003: SharePoint + Power Apps + Python local). Aguardando D1, D3, D4 e a validação S0 antes de autorizar T0.**

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

## 3. TARGET ARCHITECTURE

### 3.1 Princípios
- **Fonte imutável:** as planilhas exportadas entram como estão (raw), nunca são editadas.
- **Cálculo determinístico em código**, inputs humanos em arquivos separados e versionados.
- **Toda linha agregada aponta para as linhas de origem** (lineage por `row_key`).
- **Reconciliação como quality gate:** o pipeline falha se os totais não batem.
- Incremental: começa como CLI Python local; nada de servidor/DB até haver necessidade.

### 3.2 Componentes

```
data/raw/*.xlsx  (imutável, hash registrado)
      │
  [1] ingest      → lê aba Base, normaliza tipos, gera row_key, registra hash/linhas
      │
  [2] validate    → schema + regras de qualidade (G7, G8, G9) → relatório de DQ
      │
  [3] dims        → dicionário de nomes curtos (config/project_aliases.csv)
      │
  [4] consolidate → fato anual por (N4, projeto_curto) com ORC+BG, REAL, saldo;
      │              regra "INDIRETO — REAL SEM ORÇAMENTO"
      │
  [5] forecast    → junta inputs/forecast_inputs.csv (previsão futura por linha,
      │              classificação, justificativa, responsável, confiança, próxima ação)
      │
  [6] classify    → OPORTUNIDADE / COMPROMISSO / PRESSÃO / A VALIDAR
      │
  [7] reconcile   → compara com controles; falha se divergir
      │
  [8] publish     → snapshot datado (parquet + xlsx) + one-pager executivo (HTML)
```

### 3.3 Contratos de dados (resumo)

**`fact_line`** (saída de ingest) — `row_key` (hash estável de origem+índice+colunas-chave+mês+valor), `cen2`, `cenario`, `n4`, `n5`, `cc`, `projeto`, `finalidade`, `fornecedor`, `conta`, `grupo`, `mes` (1–12), `valor` (Decimal), `oc_rc`, `dt_contab`, `lancamento`.

**`project_alias`** (config, mantido por humano) — `projeto` (código completo) → `projeto_curto` (≤ 30 caracteres), único.

**`forecast_input`** (input humano, versionado) — chave `(n4, projeto_curto)`; campos obrigatórios: `previsao_futura`, `classificacao` ∈ {COMPROMISSO, POSTERGACAO, CANCELAMENTO, ECONOMIA, A_VALIDAR}, `justificativa`, `responsavel`, `confianca` ∈ {ALTA, MEDIA, BAIXA}, `proxima_acao`, `data_atualizacao`.

**`fact_forecast`** (saída) — por `(n4, projeto_curto)`:
```
orc_bg, realizado, saldo_atual = orc_bg − realizado
previsao_futura (input; default = 0 e status A_VALIDAR)
forecast_fechamento = realizado + previsao_futura
oportunidade_ajustada = orc_bg − forecast_fechamento
categoria:
  oportunidade_ajustada > 0 e input validado  → OPORTUNIDADE
  oportunidade_ajustada > 0 e sem input        → A VALIDAR
  oportunidade_ajustada ≈ 0                    → COMPROMISSO (saldo será realizado)
  oportunidade_ajustada < 0                    → PRESSÃO
source_row_keys: lista de row_key que compõem a linha
```

### 3.4 Regras de negócio a fixar (ver decisões)
- **R1 — Real sem orçamento:** linha (no grão definido em D1) com `orc_bg == 0` e `realizado ≠ 0` é reagrupada em `INDIRETO — REAL SEM ORÇAMENTO` dentro do seu N4, mantendo `source_row_keys`.
- **R2 — Saldo bruto vs líquido:** a visão executiva mostra **bruto positivo, pressões e líquido** separadamente (corrige G2).
- **R3 — Forecast anual, não mensal:** previsão futura é informada como valor total Nov–Dez (+ resto de Out), não derivada do faseamento do orçamento (corrige G3).
- **R4 — Sem input = A VALIDAR:** nenhum saldo vira oportunidade sem justificativa, responsável e confiança.

### 3.5 Estratégia de erros
- Erros de schema/carga → abortam (exit ≠ 0) com mensagem apontando aba/coluna/linha.
- Regras de qualidade → classificadas `ERROR` (aborta) ou `WARN` (segue e aparece no relatório). Ex.: valor nulo = WARN com contagem; linha sem origem = ERROR até decisão D4.
- Reconciliação divergente > R$ 1 → ERROR.
- Input humano com chave inexistente ou campo obrigatório vazio → ERROR listando as linhas.

### 3.6 Observabilidade
- `run_manifest.json` por execução: hash dos arquivos de entrada, contagem de linhas por etapa, totais por etapa, warnings, versão do código, timestamp.
- Relatório de qualidade `dq_report.md` versionado junto do snapshot.

### 3.7 Segurança
- Dados contêm e-mails de aprovadores e valores contratuais: `data/` fora do Git (`.gitignore`), apenas fixtures sintéticas no repositório.
- One-pager não exibe e-mails, só nomes de responsável informados no input.

### 3.8 Testes
- **Unitários** por etapa com fixtures sintéticas pequenas (casos: estouro, real sem orçamento, valor nulo, duplicata, estorno).
- **Teste de reconciliação** (golden) contra os 4 controles reproduzíveis + o de D1 quando definido.
- **Testes de propriedade:** `soma(fact_forecast.orc_bg) == soma(fact_line ORC)`; idem REAL; `forecast_fechamento == realizado + previsao` linha a linha.
- **Lineage:** toda `row_key` da entrada aparece em exatamente uma linha agregada.

### 3.9 Stack proposta
Python 3.12 · pandas (ou DuckDB se volume crescer) · pandera para schema · pytest + coverage · ruff + mypy (strict nos módulos de domínio) · openpyxl para leitura/escrita · Jinja2 para o one-pager HTML · GitHub Actions rodando lint/type/test.

Layout:
```
forecast-opex-2026/
  src/opex/{ingest,validate,dims,consolidate,forecast,classify,reconcile,publish}.py
  src/opex/domain.py        # tipos, enums, contratos
  config/project_aliases.csv
  config/controls.yaml      # números de controle por rodada
  inputs/forecast_inputs.csv
  tests/{unit,integration}/ , tests/fixtures/
  docs/adr/ , docs/ARCHITECTURE.md
  .github/copilot-instructions.md
```

---

## 4. DECISÕES NECESSÁRIAS (bloqueiam T1)

| ID | Pergunta | Recomendação |
|---|---|---|
| D1 | Qual é o grão e a regra que geram R$ 504.391 de "real sem orçamento"? | Se não houver regra documentada, adotar **N4 + Projeto** (R$ 935.757) e atualizar o controle |
| D2 | Existe repositório de código em algum lugar, ou começamos do zero? | ✅ **Resolvido:** repositório novo `Gest-o-Operacional-2026-Forecast-e-Oportunidades` (deve ficar privado) |
| D3 | Qual é a fonte da verdade do orçamento: `Base` (Acompanhamento_PLAT_CORE) ou `Orçamento…xlsx`? | `Base` — é a que reconcilia com os controles; o outro arquivo vira referência de CC futuro |
| D4 | As 2 linhas ORC sem origem (−R$ 373 mil, Dez/Outsourcing) e as 18 com valor nulo são válidas? | Manter as 2 linhas (afetam o controle) mas marcar WARN; nulos = 0 com WARN |
| D5 | Onde o forecast futuro será preenchido pelos responsáveis? | ✅ **Resolvido (ADR-003):** Power Apps sobre Lista do SharePoint; base em Excel no SharePoint; pipeline Python no notebook do Gabriel lendo exportação CSV |

---

## 5. IMPLEMENTATION PLAN

Ordem: S0 → T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11. Nenhuma tarefa começa sem a anterior aprovada. S0 e T10/T11 são executadas pelo Gabriel no Microsoft 365 (o Copilot não opera Power Apps); o Claude fornece especificação e revisa.

### S0 — Validação do ambiente Microsoft 365 (Gabriel)
- **Objetivo:** provar que as peças do ADR-003 funcionam no tenant antes de escrever código.
- **Aceite:** checklist "Validações pendentes" do ADR-003 concluído, com prints ou links.

### T0 — Esqueleto do repositório e quality gates
- **Objetivo:** repo vazio funcional com lint, type-check e testes rodando em CI.
- **Arquivos:** `pyproject.toml`, `src/opex/__init__.py`, `tests/test_smoke.py`, `.github/workflows/ci.yml`, `.github/copilot-instructions.md`, `.gitignore`, `docs/ARCHITECTURE.md`.
- **Restrições:** sem lógica de negócio; `data/` no `.gitignore`.
- **Aceite:** `ruff check`, `mypy src`, `pytest` passam local e no CI.
- **Validação:** `ruff check . && mypy src && pytest -q`
- **Prompt Copilot:**
  > Crie um projeto Python 3.12 chamado `opex` com layout `src/`. Use `pyproject.toml` (hatchling) com dependências pandas, openpyxl, pandera, pyyaml, jinja2 e dev-deps pytest, pytest-cov, ruff, mypy, pandas-stubs. Configure ruff (line-length 100, regras E,F,I,B,UP) e mypy strict para `src/opex`. Crie `tests/test_smoke.py` que importa `opex`. Crie `.github/workflows/ci.yml` que roda `ruff check .`, `mypy src` e `pytest -q --cov=opex`. Adicione `.gitignore` incluindo `data/`, `out/`, `.venv/`. Não crie nenhum módulo de negócio além de `__init__.py`.

### T1 — Domínio e contratos
- **Objetivo:** tipos e enums únicos usados por todas as etapas.
- **Arquivos:** `src/opex/domain.py`, `tests/unit/test_domain.py`.
- **Dependências:** T0.
- **Restrições:** valores monetários como `Decimal` arredondado a 2 casas na borda; enums `Cen2`, `Categoria`, `Classificacao`, `Confianca`; mapa de meses PT→int.
- **Aceite:** enums cobrem todos os valores observados; mês inválido levanta erro.
- **Validação:** `pytest tests/unit/test_domain.py -q && mypy src`
- **Prompt Copilot:**
  > Em `src/opex/domain.py`, defina: `class Cen2(StrEnum)` com `ORC_BG="ORC+BG"` e `REAL="REAL"`; `class Categoria(StrEnum)`: OPORTUNIDADE, COMPROMISSO, PRESSAO, A_VALIDAR; `class Classificacao(StrEnum)`: COMPROMISSO, POSTERGACAO, CANCELAMENTO, ECONOMIA, A_VALIDAR; `class Confianca(StrEnum)`: ALTA, MEDIA, BAIXA; constante `MESES_PT: dict[str,int]` (Janeiro→1 … Dezembro→12) e função `mes_para_int(nome: str) -> int` que aceita maiúsculas/minúsculas e levanta `ValueError` com o nome recebido se inválido. Escreva testes cobrindo os 12 meses, case-insensitive e erro. Sem dependência de pandas neste módulo.

### T2 — Ingestão com row_key e manifest
- **Objetivo:** ler a aba `Base` (header na linha 2) para um DataFrame tipado com `row_key` estável.
- **Arquivos:** `src/opex/ingest.py`, `tests/unit/test_ingest.py`, `tests/fixtures/base_min.xlsx` (gerado por script de teste).
- **Dependências:** T1.
- **Restrições:** não filtrar nem corrigir dados aqui; apenas renomear colunas para snake_case, converter `Mês` para int e `Valor` para float (nulos mantidos). `row_key` = sha1 de (nome_origem, cenario, cc, projeto, finalidade, fornecedor, conta, mes, valor, lancamento, ordem de ocorrência entre duplicatas). Registrar hash SHA-256 do arquivo e contagem de linhas.
- **Aceite:** `row_key` única; mesma entrada → mesmas chaves; contagem = linhas da aba.
- **Validação:** `pytest tests/unit/test_ingest.py -q`
- **Prompt Copilot:** detalhado na abertura da tarefa (depende de D3/D4).

### T3 — Validação de qualidade (DQ)
- **Objetivo:** schema pandera + regras G7/G8/G9 com níveis ERROR/WARN e `dq_report.md`.
- **Aceite:** reproduz na base real: 18 valores nulos (WARN), 2 linhas sem origem (conforme D4), coluna `ID Contrato / Acordo` com valor monetário (WARN).

### T4 — Dicionário de nomes curtos
- **Objetivo:** `config/project_aliases.csv` + função que aplica alias; projeto sem alias → ERROR listando faltantes.
- **Aceite:** 250 projetos cobertos; aliases únicos; ≤ 30 caracteres.

### T5 — Consolidação N4 × projeto + real sem orçamento
- **Objetivo:** `fact_forecast` base (sem input) com regra R1 no grão de D1 e lineage.
- **Aceite:** totais = controles; bruto positivo 17,54 mi e pressões −3,71 mi reproduzidos no grão N4+Projeto; cada `row_key` em exatamente uma linha.

### T6 — Forecast e classificação
- **Objetivo:** juntar `forecast_inputs.csv`, calcular forecast de fechamento e oportunidade ajustada, aplicar R2–R4.
- **Aceite:** linha sem input = A_VALIDAR; input sem justificativa/responsável/confiança = ERROR; testes para cada categoria.

### T7 — Reconciliação e manifest
- **Objetivo:** `config/controls.yaml` + verificação automática; `run_manifest.json`.
- **Aceite:** divergência > R$ 1 aborta com diff legível.

### T8 — Publicação (snapshot + one-pager)
- **Objetivo:** `out/AAAA-MM-DD/` com parquet, xlsx de trabalho e HTML de uma tela: KPIs (ORC+BG, Real, Saldo, Utilização, Forecast, Oportunidade ajustada), cascata ORC → Real → Compromissos → Pressões → Oportunidade, tabela por N4 com drill para projeto, lista "A validar" com responsável.
- **Aceite:** valores do HTML = valores do parquet (teste); sem e-mails no HTML.

---

> Ajuste do ADR-003 sobre T5–T8: a entrada do forecast passa a ser `input/AAAA-MM-DD.csv` exportado da Lista `ForecastInput`; as saídas vão para a pasta sincronizada do SharePoint. A CLI tem dois comandos: `opex prepare` e `opex publish`.

### T9 — Adaptador SharePoint (Python)
- **Objetivo:** `opex prepare` escreve `forecast_base.xlsx` (tabela `tblBase`, colunas fixas do contrato) na pasta sincronizada; `opex publish` lê o CSV exportado.
- **Restrições:** caminho da pasta via variável de ambiente `OPEX_SHAREPOINT_DIR`, nunca fixo no código; detectar arquivo bloqueado e abortar com mensagem clara; escrever em arquivo temporário e renomear (escrita atômica).
- **Aceite:** testes com diretório temporário cobrindo arquivo bloqueado, CSV com colunas faltando e CSV com `linha_id` desconhecido.

### T10 — Lista `ForecastInput` + fluxo "Fechar rodada" (Gabriel)
- **Objetivo:** lista com colunas do contrato `forecast_input`, versionamento ativado, permissões restritas; fluxo manual que exporta a lista para CSV com cabeçalhos idênticos ao contrato.
- **Aceite:** CSV exportado passa no validador da T9 sem ajustes.

### T11 — Power Apps "Forecast Opex 2026" (Gabriel)
- **Objetivo:** tela com galeria por N4 → projeto, filtro pelo responsável logado, formulário de edição dos campos de input, prévia `realizado + previsão` rotulada como prévia.
- **Restrições:** nenhuma regra de classificação no app; exportar `.msapp` para `powerplatform/` a cada versão.
- **Aceite:** responsável só edita as próprias linhas; campos obrigatórios validados; prévia bate com o teste de contrato.

## 6. Protocolo de revisão por tarefa

Para cada entrega do Copilot: ler o diff inteiro → rodar `ruff`, `mypy`, `pytest --cov` → checar contra critérios de aceite e restrições → verificar mudanças fora do escopo → classificar **APPROVED / APPROVED WITH NOTES / CHANGES REQUIRED / BLOCKED** → se CHANGES REQUIRED, emitir prompt de correção objetivo.

## 7. Registro de decisões (ADR)
- ADR-001 (proposta): Forecast anual por projeto em vez de mensal, porque o faseamento mensal do ORC+BG contém revisões lançadas fora do mês (Fev = −17,3 mi). *Status: proposto.*
- ADR-002 (proposta): Visão executiva separa saldo bruto, pressões e líquido. *Status: proposto.*
- ADR-003: Canal de entrada — SharePoint (Excel para a base, Lista para o input) + Power Apps + pipeline Python local com exportação CSV via Power Automate. *Status: aceito.* Ver `docs/adr/ADR-003-canal-de-entrada-do-forecast.md`.
