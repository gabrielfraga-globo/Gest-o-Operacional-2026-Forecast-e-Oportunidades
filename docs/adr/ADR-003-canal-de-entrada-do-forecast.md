# ADR-003 — Canal de entrada do forecast e hospedagem

- **Status:** Aceito (P1 e P2 resolvidos em 27/10/2026); validação técnica pendente na tarefa S0
- **Data:** 27/10/2026
- **Decisores:** Gabriel (dono do produto), Claude (arquitetura)

## Contexto

Os responsáveis por cada N4/projeto precisam informar, até dezembro, a previsão futura de cada saldo com
classificação, justificativa, responsável, confiança e próxima ação. O resultado alimenta uma visão
executiva de uma tela para reuniões.

- **Volume:** ~270 linhas N4 × projeto; ~10–15 responsáveis.
- **Horizonte:** uso até o fechamento de dezembro de 2026; atualização por rodada de reunião.
- **Dados sensíveis:** valores contratuais, fornecedores, e-mails corporativos.
- **Requisitos do dono:** edição **numa tela**; Excel/planilha por trás; ecossistema **Microsoft 365 /
  SharePoint** (P1); pipeline Python rodando **no notebook do Gabriel** (P2).

## Opções avaliadas

| Critério | A. CLI local + planilha | B. App Vercel + Neon | C. Microsoft 365 (SharePoint + Power Apps) + Python local |
|---|---|---|---|
| Edição numa tela | Não | Sim | Sim (Power Apps) |
| Autenticação | n/a | Construir e manter | SSO corporativo nativo |
| Onde ficam os dados | Notebook | Contas pessoais externas | Tenant corporativo |
| Esforço até a 1ª reunião | Baixo | Alto | Médio |
| Custo / termos | Zero | Hobby = uso não comercial | Licença M365 existente (conectores padrão) |
| Auditoria | Snapshot | Construir | Versionamento nativo da lista + snapshot |

## Decisão

**Opção C**, com este desenho:

| Peça | Tecnologia | Quem escreve | Quem lê |
|---|---|---|---|
| `base` (saldos da rodada) | Arquivo Excel `forecast_base.xlsx` com tabela `tblBase`, em biblioteca do SharePoint sincronizada no notebook via OneDrive | Pipeline Python (só no início da rodada) | Power Apps (somente leitura) |
| `input` (previsões) | **Lista do SharePoint** `ForecastInput`, um item por `linha_id`, com versionamento ativado | Power Apps | Pipeline (via exportação CSV) |
| `log` | Histórico de versões nativo da lista (quem, quando, valor anterior) | SharePoint | Auditoria |
| Tela | Power Apps canvas app (conectores padrão: Excel Online (Business) e SharePoint) | — | Responsáveis |
| Exportação do input | Fluxo Power Automate "Fechar rodada" (manual): lista → CSV na biblioteca sincronizada | Power Automate | Pipeline |
| Cálculo oficial | Pipeline Python no notebook, executado sob demanda | — | — |
| Saídas | Snapshot datado (xlsx/parquet) + one-pager (HTML e PDF) na biblioteca sincronizada | Pipeline | Reunião |

### Por que o input é uma Lista e não um Excel

A documentação do conector Excel Online (Business) orienta a não escrever no mesmo arquivo a partir de
vários clientes ao mesmo tempo (Excel desktop, web, Power Apps, Power Automate), sob risco de conflitos
e inconsistência; o arquivo também pode ficar bloqueado por até 6 minutos após o uso do conector.
Com 10–15 pessoas editando em paralelo, o input precisa de um armazenamento com concorrência por item:
a Lista do SharePoint. O Excel continua "por trás" para a base (escrita só pelo pipeline) e a lista pode
ser aberta/exportada no Excel a qualquer momento.

### Por que exportação CSV em vez de API

Acessar SharePoint pelo Python via Microsoft Graph normalmente exige registro de aplicativo e
consentimento do administrador. O fluxo Power Automate usa apenas conectores padrão e a sincronização
do OneDrive, sem nenhuma credencial no código. Se a TI liberar Graph no futuro, só o adaptador de
leitura do input muda.

### Fluxo de uma rodada

```
1. Gabriel roda:  opex prepare  → lê base contábil, valida, consolida, escreve forecast_base.xlsx
                                   (pasta sincronizada) e confere totais de controle
2. Responsáveis editam no Power Apps (só as próprias linhas; prévia de forecast na tela)
3. Gabriel aciona o fluxo "Fechar rodada" → ForecastInput exportada para input/AAAA-MM-DD.csv
4. Gabriel roda:  opex publish  → lê o CSV, valida, calcula, classifica, reconcilia,
                                   gera snapshot + one-pager na pasta sincronizada
```

### Regra anti-duplicação

Regras de negócio (classificação, oportunidade ajustada, reconciliação) existem **só** no Python.
O Power Apps faz apenas: validação de preenchimento; prévia rotulada `forecast = realizado + previsão`;
filtro por responsável (`User().Email`), com perfil administrador vendo tudo. O número oficial é sempre
o do pipeline. Um teste de contrato compara a prévia com o cálculo Python para os mesmos dados.

### Versionamento do Power Apps e do fluxo

Power Apps e Power Automate não vivem naturalmente no Git. Exportar o app (`.msapp`) e o fluxo
(`.zip`) a cada mudança para `powerplatform/` no repositório, com descrição no commit. A fórmula
de prévia e as regras de validação ficam documentadas em `docs/powerapps.md`.

## Consequências

- **Positivas:** dados e login dentro da empresa; nenhuma credencial no código; edição concorrente segura;
  auditoria nativa; regras testáveis sem UI; trocar Power Apps por app web no futuro afeta só adaptadores.
- **Negativas:**
  - O pipeline depende do notebook do Gabriel (ponto único). Mitigação: runbook no README, ambiente
    reproduzível (`uv`/`pyproject`), dados de saída na pasta sincronizada, não no disco local.
  - Power Apps/Power Automate têm versionamento fraco (mitigação acima).
  - Atraso de sincronização do OneDrive: o pipeline espera o arquivo estar sincronizado (checagem de hash/data).
  - Se alguém abrir `forecast_base.xlsx` no Excel durante `opex prepare`, a escrita pode falhar; o pipeline
    deve detectar o bloqueio e abortar com mensagem clara.

## Gatilhos para reavaliar

Conflitos frequentes, simulação de cenários ao vivo na reunião, uso em 2027 com mais áreas,
ou necessidade de rodar sem o notebook do Gabriel.

## Validações pendentes (tarefa S0, executada pelo Gabriel)

1. Power Apps e Power Automate habilitados no tenant para o seu usuário (licença "seeded" do M365 cobre
   conectores padrão — confirmar no seu plano).
2. Site/biblioteca do SharePoint com permissão restrita aos responsáveis, sincronizada no notebook pelo OneDrive.
3. Criar uma lista de teste e um fluxo que exporte a lista para CSV na biblioteca; confirmar que o CSV aparece
   na pasta sincronizada.
4. Abrir um Excel com tabela nessa biblioteca a partir de um app Power Apps em branco.
