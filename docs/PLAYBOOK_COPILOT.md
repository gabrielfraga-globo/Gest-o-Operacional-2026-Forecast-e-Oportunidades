# Playbook — Fase 1 com GitHub Copilot (modelo barato)

Este é o roteiro operacional da Fase 1 (interpretar, limpar e carregar a planilha no Neon).
Ele substitui a numeração de tarefas da seção 5 do `ARCHITECTURE.md` (a ordem mudou: views antes da carga).

**Papéis**
- **Claude (arquiteto):** escreve os prompts, revisa cada entrega, classifica e escreve correções.
- **Copilot (implementador):** executa um prompt por vez, sem decidir arquitetura.
- **Gabriel (operador):** cola o prompt, aprova comandos, roda a verificação, faz commit e chama a revisão.

---

## 1. Por que este formato funciona com um modelo barato

Modelos baratos erram quando precisam *decidir*. Por isso cada prompt abaixo já traz as decisões:
nomes de arquivos, assinaturas de funções, nomes de testes, valores esperados e uma lista do que **não** fazer.
O modelo só precisa *digitar*. As regras gerais ficam em `.github/copilot-instructions.md`, carregado automaticamente.

## 2. Configuração do Copilot (uma vez)

1. VS Code → Copilot Chat (`Ctrl+Alt+I`) → modo **Agent**.
2. No seletor de modelo, escolha um modelo **incluído no plano** (o que aparece com multiplicador **0x** ou sem custo de *premium request*). Não use modelos marcados com 1x ou mais na Fase 1.
3. Se um prompt falhar duas vezes seguidas no modelo barato, não insista: me mande o erro. Eu quebro o prompt em partes menores. Só em último caso troque para um modelo premium naquela tarefa.

## 3. Ciclo de cada tarefa

```
┌─ 1. git checkout main && git pull
│  2. git checkout -b tN-nome
│  3. Copilot: botão "New Chat" (sempre um chat novo por tarefa)
│  4. Colar o prompt da tarefa (seção 6) → aprovar comandos com cuidado → "Keep"
│  5. cd etl ; uv run poe check            ← tem que passar
│  6. git status                           ← nenhum .xlsx, .env, .venv, out/
│  7. git add -A ; git commit -m "feat(tN): ..." ; git push -u origin tN-nome
│  8. Avisar o Claude: "TN pronta"
│  9. Claude revisa → APPROVED / APPROVED WITH NOTES / CHANGES REQUIRED / BLOCKED
│ 10. CHANGES REQUIRED → colar o prompt de correção no MESMO chat → voltar ao passo 5
└ 11. APPROVED → abrir PR no GitHub → merge na main → próxima tarefa
```

**Regras de operação**
- Uma tarefa por branch, um chat por tarefa.
- Nunca aceite mudança em `docs/`, `.gitignore`, `README.md` ou `.github/copilot-instructions.md` vinda do Copilot.
- Nunca deixe o Copilot rodar `pip install`, `git push`, `git reset` ou comandos contra o banco de produção.
- Se o Copilot disser "não consegui" ou começar a apagar testes para passar: pare e me chame.

## 4. Ambiente de teste do banco

As tarefas T5–T8 têm testes de integração com Postgres.
- **No CI (GitHub Actions):** rodam sempre, num Postgres temporário.
- **Na sua máquina:** rodam se a variável `DATABASE_URL_TEST` existir. Sem ela, são puladas (o `poe check` continua verde).
  Para rodar localmente, crie no Neon uma **branch `test`** e coloque a URL dela em `etl/.env` como `DATABASE_URL_TEST=...`.
  **Nunca** aponte `DATABASE_URL_TEST` para a branch principal: os testes apagam dados.

## 5. Decisões embutidas nos prompts

Os prompts usam as recomendações do arquiteto. Se você discordar de alguma, me avise **antes** da tarefa indicada.

| ID | Decisão adotada | Afeta |
|---|---|---|
| D1 | "Real sem orçamento" = linha N4 × Projeto com ORC+BG = 0 e realizado ≠ 0, agrupada em `INDIRETO — REAL SEM ORÇAMENTO` por N4. Controle passa a ser **R$ 935.757,08** (125 linhas), não 504.391 | T6 |
| D3 | Fonte do orçamento e do realizado = aba `Base` da planilha *Oportunidades Opex 2026* | T2 |
| D4 | `Valor` nulo vira 0 com aviso (WARN); linha sem `Nome da Origem` é mantida com aviso | T3 |
| D7 | Linha **sem previsão preenchida**: assume-se que o saldo positivo será realizado (forecast = ORC+BG), categoria `A_VALIDAR`. Conservador: nada vira oportunidade sem justificativa | T6 |
| — | Cada carga **substitui** os lançamentos (refresh completo); previsões em `forecast_input` nunca são apagadas | T7 |
| — | Responsável por linha fica vazio na Fase 1; será preenchido no app (Fase 2) | T5 |

Números de controle (centavos, após arredondar cada lançamento): ORC+BG **68.623.868,85** · Realizado **54.790.770,92** · Saldo **13.833.097,93** · Real sem orçamento **935.757,08**.

---

## 6. Prompts

### T0 — Esqueleto do monorepo e quality gates

Branch: `t0-esqueleto`

```
Contexto: monorepo de forecast Opex 2026. Leia .github/copilot-instructions.md antes de começar. Esta tarefa cria APENAS a estrutura e os quality gates. O ambiente de desenvolvimento é Windows (PowerShell); o CI é Linux (Ubuntu).

Faça:
1. etl/pyproject.toml gerenciado por uv, build backend hatchling, pacote opex_etl em etl/src/, requires-python ">=3.12". Dependências: pandas, openpyxl, pandera, psycopg[binary]>=3.2, pyyaml, python-dotenv. Grupo de desenvolvimento ([dependency-groups] dev): pytest, pytest-cov, ruff, mypy, pandas-stubs, types-PyYAML, poethepoet.
2. No mesmo pyproject: [tool.ruff] line-length = 100 e [tool.ruff.lint] select = ["E","F","I","B","UP","SIM"]; [tool.mypy] strict = true, packages = ["opex_etl"], mypy_path = "src"; [tool.pytest.ini_options] testpaths = ["tests"], markers = ["integration: precisa de Postgres em DATABASE_URL_TEST"].
3. [tool.poe.tasks]: lint = sequência de "ruff check ." e "ruff format --check ."; typecheck = "mypy src"; test = "pytest -q --cov=opex_etl --cov-report=term-missing"; check = sequência lint, typecheck, test; fmt = "ruff format ."; migrate = "dbmate --migrations-dir ../db/migrations up".
4. etl/src/opex_etl/__init__.py com __version__ = "0.1.0"; etl/src/opex_etl/py.typed vazio.
5. etl/tests/__init__.py vazio e etl/tests/test_smoke.py com test_versao() que importa opex_etl e confere __version__ == "0.1.0".
6. etl/tests/conftest.py que: carrega etl/.env com python-dotenv se existir; define a fixture de sessão `db_url` que retorna os.environ["DATABASE_URL_TEST"] ou chama pytest.skip("DATABASE_URL_TEST não definido"); e um hook pytest_collection_modifyitems que pula testes marcados com integration quando a variável não existe.
7. db/migrations/.gitkeep.
8. .env.example na raiz, com comentários: DATABASE_URL=postgres://user:pass@host/db?sslmode=require (Neon, branch principal; usado só pelo comando de carga) e DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/opex_test?sslmode=disable (banco descartável para testes; nunca a branch principal).
9. .github/workflows/ci.yml: on push e pull_request; job em ubuntu-latest; services.postgres com image postgres:16, env POSTGRES_PASSWORD=postgres e POSTGRES_DB=opex_test, porta 5432, healthcheck com pg_isready; env DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/opex_test?sslmode=disable; passos: checkout; astral-sh/setup-uv; instalar dbmate com curl do release oficial (https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64) para /usr/local/bin/dbmate e chmod +x; "dbmate --url $DATABASE_URL_TEST --migrations-dir db/migrations --no-dump-schema up"; depois, com working-directory etl: "uv sync" e "uv run poe check".
10. Rode "uv sync" dentro de etl/ para gerar etl/uv.lock e depois "uv run poe check".

Não faça: tabelas, views, módulos de negócio, leitura de planilha, Makefile. Não altere docs/, README.md, .gitignore, .github/copilot-instructions.md. Não adicione dependências além das listadas. Não use pip.

Pronto quando: dentro de etl/, "uv run poe check" passa. Ao terminar, liste os arquivos criados.
```

### T1 — Domínio e contratos

Branch: `t1-dominio`

```
Leia .github/copilot-instructions.md. Tarefa T1: criar o módulo de domínio, sem I/O e sem pandas.

Crie etl/src/opex_etl/domain.py com:
1. Enums (StrEnum):
   - Cen2: ORC_BG = "ORC_BG", REAL = "REAL". Função cen2_da_planilha(valor: str) -> Cen2 que converte "ORC+BG" -> ORC_BG e "REAL" -> REAL (ignora espaços nas pontas) e levanta ValueError(f"CEN2 inválido: {valor!r}") para qualquer outro valor.
   - Classificacao: COMPROMISSO, POSTERGACAO, CANCELAMENTO, ECONOMIA, A_VALIDAR (valor = nome).
   - Confianca: ALTA, MEDIA, BAIXA.
   - Categoria: OPORTUNIDADE, COMPROMISSO, PRESSAO, A_VALIDAR.
   - Severidade: ERROR, WARN.
2. MESES_PT: dict[str, int] com "janeiro":1 ... "dezembro":12 (minúsculas, com acento em "março"). Função mes_para_int(nome: str) -> int: compara em minúsculas sem espaços nas pontas; aceita "marco" e "março"; levanta ValueError(f"Mês inválido: {nome!r}").
3. ABA_BASE = "Base" e LINHA_CABECALHO = 1 (índice zero-based para pandas header=).
4. COLUNAS_BASE: dict[str, str] mapeando nome original -> nome interno, exatamente:
   "Nome da Origem"->"origem", "Cenário"->"cenario", "CEN2"->"cen2", "Centro de Custo"->"centro_custo",
   "Conta"->"conta", "Projeto"->"projeto", "Finalidade"->"finalidade", "Grupo"->"grupo",
   "Fornecedor"->"fornecedor", "Mês"->"mes", "Valor"->"valor", "DS_LINHA_LANCTO_CONTABIL"->"lancamento",
   "OC/RC"->"oc_rc", "DT_CONTABILIZACAO"->"dt_contabilizacao", "N4"->"n4", "N5"->"n5".
5. COLUNAS_OBRIGATORIAS: tuple[str, ...] = ("cenario","cen2","centro_custo","conta","projeto","n4","mes","valor").
6. CAMPOS_ROW_KEY: tuple[str, ...] = ("origem","cenario","cen2","centro_custo","conta","projeto","finalidade","fornecedor","n4","n5","mes","valor","lancamento","oc_rc").
7. PROJETO_REAL_SEM_ORCAMENTO = "__REAL_SEM_ORC__" e NOME_REAL_SEM_ORCAMENTO = "INDIRETO — REAL SEM ORÇAMENTO".

Crie etl/tests/unit/__init__.py e etl/tests/unit/test_domain.py com os testes:
- test_cen2_converte_orc_bg_e_real
- test_cen2_invalido_levanta_erro (usar pytest.raises com match="CEN2 inválido")
- test_mes_para_int_todos_os_meses (parametrize com os 12 nomes como aparecem na planilha: "Janeiro", "Fevereiro", "Março", ..., "Dezembro")
- test_mes_para_int_aceita_minusculas_espacos_e_marco_sem_acento
- test_mes_invalido_levanta_erro
- test_colunas_obrigatorias_e_row_key_existem_no_mapeamento (todo item de COLUNAS_OBRIGATORIAS e CAMPOS_ROW_KEY está em COLUNAS_BASE.values())

Não faça: nada fora de domain.py e dos testes. Não importe pandas em domain.py.
Pronto quando: cd etl; uv run poe check passa.
```

### T2 — Ingestão com row_key

Branch: `t2-ingestao`

```
Leia .github/copilot-instructions.md e etl/src/opex_etl/domain.py. Tarefa T2: ler a aba Base da planilha para um DataFrame tipado com chave estável.

1. Crie etl/src/opex_etl/ingest.py com:
   - @dataclass(frozen=True) class ResultadoIngestao: caminho: Path; sha256: str; linhas_lidas: int; dados: pd.DataFrame.
   - class ErroIngestao(Exception).
   - def sha256_arquivo(caminho: Path) -> str: lê em blocos de 1 MiB.
   - def ler_base(caminho: Path) -> ResultadoIngestao:
     a) pd.read_excel(caminho, sheet_name=ABA_BASE, header=LINHA_CABECALHO, engine="openpyxl", dtype=object).
        Se a aba não existir: ErroIngestao(f"Aba {ABA_BASE!r} não encontrada em {caminho.name}").
     b) Se faltar alguma coluna de COLUNAS_BASE.keys(): ErroIngestao listando as faltantes em ordem alfabética.
     c) Mantém só as colunas de COLUNAS_BASE e renomeia para os nomes internos.
     d) Remove linhas totalmente vazias. Adiciona coluna "linha_planilha" = número da linha no Excel (índice original + 3, porque o cabeçalho está na linha 2 do Excel).
     e) Textos: strip; string vazia vira None.
     f) "mes": aplica mes_para_int; erro vira ErroIngestao(f"Linha {linha_planilha}: mês inválido {valor!r}").
     g) "cen2": aplica cen2_da_planilha e guarda o .value (string "ORC_BG"/"REAL"); erro vira ErroIngestao com a linha.
     h) "valor": converte para float; não converte nulos (fica NaN; a validação trata).
     i) "dt_contabilizacao": pd.to_datetime(errors="coerce").dt.date.
     j) "row_key": sha1 hexadecimal de "|".join(str(v) if v is not None and v == v else "" for v in campos de CAMPOS_ROW_KEY) + f"#{ocorrencia}", onde ocorrencia é o groupby(list(CAMPOS_ROW_KEY), dropna=False).cumcount(). Para "valor" use f"{v:.2f}" quando não for nulo.
     k) Retorna ResultadoIngestao com linhas_lidas = número de linhas após (d).

2. Crie etl/tests/fixtures/__init__.py e etl/tests/fixtures/planilhas.py com a função criar_planilha_base(caminho: Path, linhas: list[dict[str, object]]) -> Path que usa openpyxl para criar um .xlsx com: aba "Análise" vazia, aba "Base" com a linha 1 vazia, cabeçalho na linha 2 com TODAS as chaves de COLUNAS_BASE (na ordem do dict) e as linhas a partir da 3. Chaves ausentes em cada dict ficam vazias. Também a constante LINHA_PADRAO: dict com valores válidos e sintéticos para todas as colunas (ex.: "Nome da Origem": "GL_Realizado", "Cenário": "REALIZADO", "CEN2": "REAL", "Centro de Custo": "CC1", "Conta": "C1", "Projeto": "P1 - PROJETO UM/NA/NA", "Finalidade": "F1", "Grupo": "CONTRATOS", "Fornecedor": "FORN A", "Mês": "Janeiro", "Valor": 100.0, "N4": "N4 A", "N5": "N5 A").

3. Crie etl/tests/unit/test_ingest.py (use tmp_path):
   - test_le_base_renomeia_e_tipa
   - test_linha_planilha_comeca_em_3
   - test_row_key_unica_inclusive_com_linhas_identicas (duas linhas idênticas -> duas chaves diferentes)
   - test_row_key_deterministica (ler duas vezes o mesmo arquivo -> mesmas chaves)
   - test_valor_nulo_permanece_nan
   - test_aba_ausente_levanta_erro
   - test_coluna_ausente_levanta_erro_listando_coluna
   - test_mes_invalido_informa_linha (mensagem contém "Linha 3")
   - test_sha256_muda_quando_conteudo_muda

Não faça: validação de qualidade, banco, CLI. Não leia arquivos de data/ nos testes.
Pronto quando: cd etl; uv run poe check passa.
```

### T3 — Validação de qualidade

Branch: `t3-qualidade`

```
Leia .github/copilot-instructions.md, domain.py e ingest.py. Tarefa T3: regras de qualidade e relatório.

1. Crie etl/src/opex_etl/validate.py com:
   - @dataclass(frozen=True) class Problema: severidade: Severidade; regra: str; mensagem: str; linhas: tuple[int, ...] (números de linha da planilha, no máximo 20 guardados; a mensagem informa o total).
   - def validar(df: pd.DataFrame) -> list[Problema], com estas regras, nesta ordem:
     - OBRIGATORIO_NULO (ERROR): qualquer coluna de COLUNAS_OBRIGATORIAS, exceto "valor", com nulo. Um Problema por coluna.
     - VALOR_NULO (WARN): "valor" nulo. Mensagem: "{n} lançamento(s) sem valor; tratados como 0".
     - ORIGEM_NULA (WARN): "origem" nula. Mensagem inclui a soma dos valores dessas linhas formatada com 2 casas.
     - ROW_KEY_DUPLICADA (ERROR): "row_key" duplicada.
     - CENARIO_INCOERENTE (ERROR): cen2 == "REAL" e cenario != "REALIZADO", ou cen2 == "ORC_BG" e cenario == "REALIZADO".
   - def aplicar_correcoes(df: pd.DataFrame) -> pd.DataFrame: devolve cópia com "valor" nulo trocado por 0.0 e "valor" arredondado para 2 casas.
   - def tem_erro(problemas: list[Problema]) -> bool.
   - def relatorio_markdown(problemas: list[Problema], linhas_lidas: int, sha256: str) -> str: título "# Relatório de qualidade", linhas lidas, sha256, e uma tabela "| Severidade | Regra | Mensagem | Linhas (amostra) |". Sem problemas: escreve "Nenhum problema encontrado.".

2. Crie etl/tests/unit/test_validate.py usando criar_planilha_base + ler_base (ou DataFrames montados direto):
   - test_base_limpa_sem_problemas
   - test_valor_nulo_gera_warn_e_correcao_zera
   - test_origem_nula_gera_warn_com_soma
   - test_obrigatorio_nulo_gera_error_por_coluna
   - test_cenario_incoerente_gera_error
   - test_linhas_limitadas_a_20_e_mensagem_com_total
   - test_relatorio_markdown_contem_tabela_e_sha
   - test_aplicar_correcoes_arredonda_para_centavos

Não faça: banco, CLI, alteração em ingest.py (se achar necessário, descreva no final em vez de alterar).
Pronto quando: cd etl; uv run poe check passa.
```

### T4 — Nomes curtos dos projetos

Branch: `t4-nomes-curtos`

```
Leia .github/copilot-instructions.md e domain.py. Tarefa T4: nomes curtos de projeto.

1. Crie etl/src/opex_etl/normalize.py com:
   - class AliasFaltanteError(Exception) com atributo faltantes: list[str].
   - def sugerir_nome_curto(codigo: str) -> str:
     remove o prefixo até o primeiro " - " (inclusive), remove o sufixo "/NA/NA" e qualquer "/NA" final, faz strip, converte para Title Case com estas exceções: as preposições/artigos DE, DA, DO, DAS, DOS, EM, E, A, O, NA, NO, PARA, COM ficam em minúsculas (exceto se forem a primeira palavra) e as demais palavras de até 3 letras que estavam todas em maiúsculas são mantidas em maiúsculas (siglas); depois corta em 30 caracteres sem deixar espaço no fim. Se o código contiver "INDIRETO", retorna "Indireto".
   - def sugerir_aliases(codigos: Iterable[str]) -> dict[str, str]: aplica sugerir_nome_curto; se dois códigos gerarem o mesmo nome, acrescenta " (" + primeiros 12 caracteres do código + ")" e corta no limite de 30 de forma que fiquem únicos; resultado ordenado por código.
   - def ler_aliases(caminho: Path) -> dict[str, str]: CSV UTF-8 com cabeçalho "codigo,nome_curto". Valida: nome_curto não vazio, até 30 caracteres, únicos. Erros viram ValueError com a linha do CSV.
   - def escrever_aliases(caminho: Path, aliases: Mapping[str, str]) -> None: CSV UTF-8, cabeçalho codigo,nome_curto, ordenado por codigo.
   - def aplicar_aliases(df: pd.DataFrame, aliases: Mapping[str, str]) -> pd.DataFrame: devolve cópia com coluna "projeto_curto"; se houver código sem alias, levanta AliasFaltanteError com a lista ordenada.
2. Testes em etl/tests/unit/test_normalize.py:
   - test_sugere_nome_remove_prefixo_e_sufixo ("I.EST.000072-999-999 - OUTSOURCING/NA/NA" -> "Outsourcing")
   - test_indireto ("0000000000000000 - INDIRETO" -> "Indireto")
   - test_corta_em_30_sem_espaco_final
   - test_preserva_siglas_curtas ("I.EST.1 - INOVAÇÃO EM MSC/NA/NA" -> "Inovação em MSC")
   - test_preposicoes_em_minusculas ("X - PLATAFORMA DE PRODUÇÃO/NA/NA" -> "Plataforma de Produção")
   - test_sugerir_aliases_resolve_colisoes_e_mantem_unicos
   - test_ler_e_escrever_aliases_ida_e_volta (tmp_path)
   - test_ler_aliases_rejeita_duplicado_e_maior_que_30
   - test_aplicar_aliases_faltante_lista_codigos

Não faça: CLI (virá na T8), banco, criação do config/project_aliases.csv real.
Pronto quando: cd etl; uv run poe check passa.
```

### T5 — Schema do banco

Branch: `t5-schema`

```
Leia .github/copilot-instructions.md e docs/ARCHITECTURE.md seção 3.4. Tarefa T5: migrations SQL com dbmate. Cada arquivo tem "-- migrate:up" e "-- migrate:down" e o down desfaz exatamente o up.

Crie em db/migrations/:
1. 20261028000001_enums.sql: tipos enum cen2 ('ORC_BG','REAL'); classificacao ('COMPROMISSO','POSTERGACAO','CANCELAMENTO','ECONOMIA','A_VALIDAR'); confianca ('ALTA','MEDIA','BAIXA').
2. 20261028000002_dimensoes.sql:
   - dim_n4 (n4_id serial primary key, nome text not null unique)
   - dim_projeto (projeto_id serial primary key, codigo text not null unique, nome_curto text not null unique check (char_length(nome_curto) <= 40))
   - insert em dim_projeto da linha especial ('__REAL_SEM_ORC__', 'INDIRETO — REAL SEM ORÇAMENTO').
3. 20261028000003_import_e_fato.sql:
   - import_run (id bigserial primary key, arquivo text not null, sha256 char(64) not null, iniciado_em timestamptz not null default now(), linhas_lidas integer not null, status text not null check (status in ('ok','failed')), relatorio_dq text, reconciliacao jsonb)
   - indice único parcial: unique (sha256) where status = 'ok'
   - fato_lancamento (row_key char(40) primary key, import_run_id bigint not null references import_run(id), cen2 cen2 not null, cenario text not null, n4_id integer not null references dim_n4, n5 text, centro_custo text not null, projeto_id integer not null references dim_projeto, finalidade text, fornecedor text, conta text not null, grupo text, mes smallint not null check (mes between 1 and 12), valor numeric(18,2) not null, origem text, lancamento text, oc_rc text, dt_contabilizacao date, linha_planilha integer not null)
   - índices em fato_lancamento (n4_id, projeto_id) e (cen2).
4. 20261028000004_forecast.sql:
   - forecast_linha (linha_id serial primary key, n4_id integer not null references dim_n4, projeto_id integer not null references dim_projeto, responsavel text, ativo boolean not null default true, unique (n4_id, projeto_id))
   - forecast_input (linha_id integer primary key references forecast_linha on delete restrict, previsao_futura numeric(18,2) check (previsao_futura >= 0), classificacao classificacao not null default 'A_VALIDAR', justificativa text, confianca confianca, proxima_acao text, responsavel text, atualizado_por text, atualizado_em timestamptz, versao integer not null default 1)
   - forecast_input_hist (id bigserial primary key, linha_id integer not null, versao integer not null, dados jsonb not null, registrado_em timestamptz not null default now())
   - função plpgsql forecast_input_historico() e trigger BEFORE UPDATE em forecast_input que: insere em forecast_input_hist (OLD.linha_id, OLD.versao, to_jsonb(OLD)); faz NEW.versao := OLD.versao + 1; NEW.atualizado_em := now(). Retorna NEW.

5. Crie etl/tests/integration/__init__.py e etl/tests/integration/conftest.py com a fixture `conn` (escopo de função) que: conecta em db_url com psycopg; executa "drop schema public cascade; create schema public;" ; roda as migrations chamando subprocess ["dbmate", "--url", db_url, "--migrations-dir", <caminho absoluto de db/migrations>, "--no-dump-schema", "up"]; entrega a conexão com autocommit=False; fecha no final. Se o executável dbmate não existir, pytest.skip.
6. Crie etl/tests/integration/test_schema.py, todos com @pytest.mark.integration:
   - test_tabelas_existem (as 7 tabelas)
   - test_projeto_especial_existe
   - test_mes_fora_do_intervalo_falha
   - test_previsao_negativa_falha
   - test_update_em_forecast_input_grava_historico_e_incrementa_versao
   - test_sha256_ok_duplicado_falha_mas_failed_duplicado_passa
7. No .github/workflows/ci.yml NÃO mude nada (ele já roda dbmate e o check). Confirme apenas que os testes de integração rodam no CI porque DATABASE_URL_TEST está definido lá.

Não faça: views (T6), código Python de carga, criação de usuários/roles (é manual no Neon), alteração de migrations de outras tarefas.
Pronto quando: cd etl; uv run poe check passa (localmente os testes de integração podem ser pulados) e o CI fica verde no push.
```

### T6 — Views de regra de negócio

Branch: `t6-views`

```
Leia .github/copilot-instructions.md, docs/ARCHITECTURE.md seção 3.5 e db/migrations/*. Tarefa T6: views com as regras de negócio. Nenhuma regra em Python.

Crie db/migrations/20261028000005_views.sql (up cria, down remove na ordem inversa), com:
1. vw_saldo_linha: por (n4_id, projeto_id) a partir de fato_lancamento:
   orc_bg = coalesce(sum(valor) filter (where cen2='ORC_BG'),0); realizado = coalesce(sum(valor) filter (where cen2='REAL'),0); source_count = count(*).
2. vw_saldo_reagrupado: a partir de vw_saldo_linha. Linha com orc_bg = 0 e realizado <> 0 tem projeto_id substituído pelo projeto_id de dim_projeto onde codigo='__REAL_SEM_ORC__'. Agrega por (n4_id, projeto_id) somando orc_bg, realizado, source_count. Colunas: n4_id, projeto_id, orc_bg, realizado, saldo_atual (= orc_bg - realizado), source_count.
3. vw_forecast: vw_saldo_reagrupado s join forecast_linha l on (n4_id, projeto_id) left join forecast_input i on linha_id. Colunas: linha_id, n4_id, projeto_id, n4 (dim_n4.nome), projeto (dim_projeto.nome_curto), orc_bg, realizado, saldo_atual, previsao_futura (i.previsao_futura), classificacao, confianca, justificativa, proxima_acao, responsavel (coalesce(i.responsavel, l.responsavel)), input_completo, forecast_fechamento, oportunidade_ajustada, categoria. Regras:
   - input_completo = i.previsao_futura is not null and i.classificacao <> 'A_VALIDAR' and nullif(trim(i.justificativa),'') is not null and i.confianca is not null and nullif(trim(i.proxima_acao),'') is not null and nullif(trim(coalesce(i.responsavel,l.responsavel)),'') is not null
   - forecast_fechamento = realizado + coalesce(i.previsao_futura, greatest(saldo_atual, 0))
   - oportunidade_ajustada = orc_bg - forecast_fechamento
   - categoria (text): se not input_completo -> 'A_VALIDAR'; senão se oportunidade_ajustada < -1 -> 'PRESSAO'; senão se oportunidade_ajustada > 1 -> 'OPORTUNIDADE'; senão 'COMPROMISSO'.
   - Exceção: se saldo_atual < -1 e não houver input completo, categoria = 'PRESSAO' (estouro já ocorrido não depende de input).
   - Somente linhas com l.ativo = true.
4. vw_resumo_n4: por n4 a partir de vw_forecast: orc_bg, realizado, saldo_liquido (sum saldo_atual), saldo_bruto_positivo (sum de saldo_atual > 0), pressoes (sum de saldo_atual < 0), forecast_fechamento, oportunidade_ajustada (sum de oportunidade_ajustada onde categoria='OPORTUNIDADE'), linhas, linhas_com_input (count where input_completo), pct_com_input (numeric com 4 casas; 0 se linhas = 0).
5. vw_reconciliacao: uma linha com orc_bg, realizado, saldo (orc_bg - realizado), utilizacao (realizado/orc_bg com 4 casas, null se orc_bg = 0), real_sem_orcamento (soma de realizado em vw_saldo_reagrupado do projeto especial), linhas_real_sem_orcamento (count de vw_saldo_linha com orc_bg = 0 and realizado <> 0).

Crie etl/tests/integration/test_views.py (@pytest.mark.integration) com um helper que insere dim_n4, dim_projeto, um import_run status 'ok', fato_lancamento e forecast_linha sintéticos. Testes:
- test_saldo_linha_soma_por_cen2
- test_real_sem_orcamento_e_reagrupado_no_projeto_especial
- test_sem_input_assume_saldo_realizado_e_categoria_a_validar (orc 100, real 40 -> forecast 100, oportunidade 0, A_VALIDAR)
- test_estouro_sem_input_e_pressao (orc 100, real 150)
- test_input_completo_com_sobra_e_oportunidade (orc 100, real 40, previsao 20 -> forecast 60, oportunidade 40)
- test_input_completo_igual_saldo_e_compromisso
- test_input_incompleto_continua_a_validar (falta justificativa)
- test_linha_inativa_nao_aparece
- test_resumo_n4_separa_bruto_e_pressoes
- test_reconciliacao_totais

Não faça: código Python de carga, alteração de migrations anteriores.
Pronto quando: poe check passa e CI verde.
```

### T7 — Carga idempotente com reconciliação

Branch: `t7-carga`

```
Leia .github/copilot-instructions.md, domain.py, ingest.py, validate.py, normalize.py e db/migrations/*. Tarefa T7: carregar no banco numa transação única, com reconciliação.

1. Crie config/controls.yaml na raiz:
   tolerancia: 1.00
   controles:
     orc_bg: 68623868.85
     realizado: 54790770.92
     saldo: 13833097.93
     real_sem_orcamento: 935757.08
2. Crie etl/src/opex_etl/reconcile.py:
   - @dataclass(frozen=True) class ResultadoControle: nome: str; esperado: Decimal; obtido: Decimal; diferenca: Decimal; ok: bool.
   - def ler_controles(caminho: Path) -> tuple[Decimal, dict[str, Decimal]].
   - def reconciliar(conn: psycopg.Connection, tolerancia: Decimal, controles: Mapping[str, Decimal]) -> list[ResultadoControle]: lê vw_reconciliacao e compara cada controle existente nela; controle desconhecido levanta ValueError.
3. Crie etl/src/opex_etl/load.py:
   - class JaCarregadoError(Exception) e class ReconciliacaoError(Exception) (com atributo resultados).
   - def carregar(conn, ingestao: ResultadoIngestao, df: pd.DataFrame, relatorio_dq: str, tolerancia: Decimal, controles: Mapping[str, Decimal]) -> int:
     a) se existir import_run com o mesmo sha256 e status 'ok': levanta JaCarregadoError.
     b) numa transação (with conn.transaction()):
        - insere import_run com status 'ok' provisório e pega o id;
        - upsert de dim_n4 (nomes distintos de df.n4) e dim_projeto (codigo=projeto, nome_curto=projeto_curto; on conflict (codigo) do update set nome_curto);
        - delete from fato_lancamento;
        - insere todas as linhas com COPY (cursor.copy) mapeando n4 -> n4_id e projeto -> projeto_id;
        - insere forecast_linha a partir de "select distinct n4_id, projeto_id from vw_saldo_reagrupado" on conflict do nothing;
        - update forecast_linha set ativo = (n4_id, projeto_id) in (select n4_id, projeto_id from vw_saldo_reagrupado);
        - chama reconciliar; se algum não ok, levanta ReconciliacaoError (a transação inteira é desfeita).
        - grava em import_run.reconciliacao o JSON dos resultados.
     c) se ReconciliacaoError: em transação separada, insere import_run com status 'failed', relatorio_dq e o JSON da reconciliação; relança.
     d) retorna o id do import_run ok.
     NUNCA apague nem altere linhas de forecast_input.
4. Testes em etl/tests/integration/test_load.py (@pytest.mark.integration), usando criar_planilha_base + ler_base + aplicar_correcoes + aplicar_aliases e controles calculados para a planilha sintética:
   - test_carga_ok_grava_fatos_dimensoes_e_linhas
   - test_mesmo_arquivo_duas_vezes_levanta_ja_carregado
   - test_recarga_com_arquivo_novo_substitui_fatos_e_preserva_forecast_input
   - test_linha_que_some_fica_inativa
   - test_reconciliacao_divergente_desfaz_carga_e_registra_failed
   - test_real_sem_orcamento_gera_linha_especial

Não faça: CLI (T8), alteração em views ou migrations.
Pronto quando: poe check passa e CI verde.
```

### T8 — CLI e primeira carga real

Branch: `t8-cli`

```
Leia .github/copilot-instructions.md e todos os módulos de etl/src/opex_etl. Tarefa T8: linha de comando.

1. Crie etl/src/opex_etl/cli.py com argparse e uma função main(argv: list[str] | None = None) -> int. Subcomandos:
   - "gerar-aliases <planilha> [--saida config/project_aliases.csv]": ler_base -> códigos distintos de "projeto" -> sugerir_aliases -> se o arquivo já existir, mantém os nomes existentes e só acrescenta códigos novos -> escrever_aliases. Imprime quantos foram mantidos e quantos novos.
   - "validar <planilha> [--aliases config/project_aliases.csv]": ler_base, validar, aplicar_aliases (só para checar faltantes), grava out/dq_report.md (cria a pasta out/), imprime resumo. Exit 1 se houver ERROR ou alias faltante.
   - "carregar <planilha> [--aliases ...] [--controles config/controls.yaml]": exige DATABASE_URL (lido de etl/.env ou do ambiente); valida; se tem_erro, exit 1 sem tocar no banco; aplica correções e aliases; chama carregar. JaCarregadoError -> imprime "Arquivo já carregado (sha256 ...)" e exit 0. ReconciliacaoError -> imprime tabela esperado/obtido/diferença e exit 2. Sucesso -> imprime id do import_run e a tabela de reconciliação, exit 0.
   - "status": exige DATABASE_URL; imprime os últimos 5 import_run (id, iniciado_em, arquivo, status) e a vw_reconciliacao atual.
   Caminhos relativos são resolvidos a partir da raiz do repositório (pasta que contém db/), não do diretório atual.
   Nunca imprima a DATABASE_URL.
2. Em etl/pyproject.toml adicione [project.scripts] opex-etl = "opex_etl.cli:main".
3. Testes em etl/tests/unit/test_cli.py (sem banco): gerar-aliases cria e depois preserva nomes existentes; validar retorna 1 com ERROR e 0 sem; carregar sem DATABASE_URL retorna 1 com mensagem clara. Em etl/tests/integration/test_cli_integration.py: carregar com planilha sintética retorna 0 e status mostra o import.

Não faça: alteração em módulos anteriores além do estritamente necessário para a CLI (se precisar, descreva no final).
Pronto quando: poe check passa e CI verde.
```

**Primeira carga real (você, depois do APPROVED da T8):**
```powershell
cd "C:\dev\github\enterprise\Operacional 2026"
mkdir data\raw -Force
copy "Oportunidades Opex 2026 Plataformas de Produção.xlsx" data\raw\
cd etl
uv run opex-etl gerar-aliases "..\data\raw\Oportunidades Opex 2026 Plataformas de Produção.xlsx"
# revise config\project_aliases.csv (nomes curtos legíveis para a reunião) e faça commit dele
uv run opex-etl validar "..\data\raw\Oportunidades Opex 2026 Plataformas de Produção.xlsx"
uv run poe migrate        # com DATABASE_URL da branch principal do Neon em etl\.env
uv run opex-etl carregar "..\data\raw\Oportunidades Opex 2026 Plataformas de Produção.xlsx"
uv run opex-etl status
```
Resultado esperado: reconciliação com os 4 controles `ok` e cerca de 170 linhas de coleta.

---

## 7. Como peço correções

Quando a revisão for **CHANGES REQUIRED**, eu entrego um bloco assim, para colar no mesmo chat da tarefa:

```
Correção da tarefa TN (revisão do arquiteto). Corrija SOMENTE os itens abaixo, sem outras mudanças:
1. <arquivo>: <problema> -> <o que fazer>
2. ...
Depois rode cd etl; uv run poe check e mostre a saída.
```

## 8. Status

| Tarefa | Status | Revisão |
|---|---|---|
| T0 | em andamento | — |
| T1–T8 | aguardando | — |
