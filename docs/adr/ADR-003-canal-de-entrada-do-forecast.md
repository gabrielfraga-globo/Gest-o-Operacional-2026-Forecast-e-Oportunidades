# ADR-003 — Canal de entrada do forecast e hospedagem

- **Status:** Proposto (aguardando confirmação de Gabriel)
- **Data:** 27/10/2026
- **Decisores:** Gabriel (dono do produto), Claude (arquitetura)

## Contexto

Os responsáveis por cada N4/projeto precisam informar, até dezembro, a previsão futura de cada saldo com
classificação, justificativa, responsável, confiança e próxima ação. O resultado alimenta uma visão
executiva de uma tela para reuniões.

Características do problema:
- **Volume pequeno:** ~270 linhas N4 × projeto; ~10–15 responsáveis.
- **Horizonte curto:** o forecast é útil até o fechamento de dezembro de 2026, com ~2 meses de uso.
- **Dados sensíveis:** valores contratuais, fornecedores e e-mails corporativos de aprovadores.
- **Cadência:** atualização por rodada de reunião, não em tempo real.

A stack Vercel + Neon foi trazida de outro projeto que precisava de interatividade.

## Opções

| Critério | A. CLI local + planilha de input | B. App web Vercel + Neon | C. Planilha corporativa compartilhada + pipeline Python |
|---|---|---|---|
| Responsáveis preenchem sozinhos | Não — arquivos voltam por e-mail e alguém consolida | Sim | Sim, cada um na sua aba ou faixa protegida |
| Autenticação | Não se aplica | Precisa ser construída e mantida | Já existe (SSO corporativo) |
| Onde ficam os dados | Máquina local | Contas pessoais Vercel/Neon fora do controle da empresa | Dentro do tenant corporativo |
| Validação dos campos | Só na execução do pipeline | Formulário + API | Validação de dados da planilha + pipeline |
| Esforço até a 1ª reunião | Baixo | Alto (UI, API, auth, deploy, migrations) | Baixo/médio |
| Custo e termos de uso | Zero | Plano Hobby é para uso não comercial | Zero (licença existente) |
| Interatividade da visão executiva | HTML estático gerado | Total | HTML gerado ou dashboard na própria ferramenta |
| Histórico/auditoria | Snapshot por rodada | Precisa ser construído | Histórico de versões nativo + snapshot por rodada |

## Decisão proposta

**Opção C agora, com o núcleo de cálculo isolado de forma que a opção B possa ser adotada depois sem
reescrever regras de negócio.**

Arquitetura em camadas (ports & adapters):

```
┌─────────────── adaptadores de entrada ───────────────┐
│ ExcelBaseReader (planilha de origem)                 │
│ ForecastInputReader  ← planilha corporativa (C)       │
│                      ← (futuro) Postgres/Neon (B)     │
└───────────────────────────┬──────────────────────────┘
                            ▼
           núcleo de domínio puro (Python, sem I/O)
   consolidar · aplicar forecast · classificar · reconciliar
                            ▼
┌──────────────── adaptadores de saída ────────────────┐
│ Snapshot (parquet/xlsx) · One-pager HTML              │
│ ForecastTemplateWriter → gera/atualiza a planilha de  │
│   input com os saldos pré-preenchidos por responsável │
└──────────────────────────────────────────────────────┘
```

Fluxo de cada rodada:
1. O pipeline lê a base e gera a planilha de input com N4, projeto, ORC+BG, realizado e saldo
   pré-preenchidos (somente leitura) e as colunas de input vazias ou com o valor da rodada anterior.
2. Cada responsável preenche apenas as suas linhas (faixas protegidas, listas de validação para
   classificação e confiança).
3. O pipeline lê o input, valida (campo obrigatório vazio = erro listando a linha), calcula, reconcilia
   e publica snapshot + one-pager.

## Consequências

- **Positivas:** dados ficam no ambiente corporativo; autenticação resolvida; primeira reunião possível em
  dias; regras de negócio 100% testáveis sem UI; troca para B depois afeta só um adaptador.
- **Negativas:** a interatividade da visão executiva fica limitada a filtros do HTML; a validação na planilha é
  mais fraca que a de um formulário (compensada pela validação no pipeline).
- **Gatilhos para reavaliar e migrar para B:** (a) a planilha compartilhada gerar conflitos frequentes de
  edição; (b) a necessidade de cenários what-if ao vivo na reunião; (c) o uso continuar em 2027 com
  mais áreas. Pré-requisitos de B: aprovação de segurança da informação para hospedagem externa,
  autenticação obrigatória desde o primeiro deploy, e conta/plano compatível com uso corporativo.

## Pendências para fechar este ADR

1. Qual ferramenta corporativa os responsáveis já usam (Google Sheets no Workspace ou Excel no SharePoint/OneDrive)?
2. Confirmar que o repositório ficará privado (independente da opção, o código e o ARCHITECTURE.md contêm números da empresa).
