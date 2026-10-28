# ADR-003 — Canal de entrada do forecast e hospedagem

- **Status:** Aceito com pendências (P1, P2)
- **Data:** 27/10/2026
- **Decisores:** Gabriel (dono do produto), Claude (arquitetura)

## Contexto

Os responsáveis por cada N4/projeto precisam informar, até dezembro, a previsão futura de cada saldo com
classificação, justificativa, responsável, confiança e próxima ação. O resultado alimenta uma visão
executiva de uma tela para reuniões.

- **Volume pequeno:** ~270 linhas N4 × projeto; ~10–15 responsáveis.
- **Horizonte curto:** uso até o fechamento de dezembro de 2026.
- **Dados sensíveis:** valores contratuais, fornecedores, e-mails corporativos.
- **Cadência:** atualização por rodada de reunião.
- **Requisito do dono (27/10):** a edição acontece **numa tela**, não diretamente nas células; a planilha
  (Google Sheets ou Excel) pode ser o armazenamento por trás.

A stack Vercel + Neon foi trazida de outro projeto que precisava de interatividade.

## Opções avaliadas

| Critério | A. CLI local + planilha | B. App Vercel + Neon | C. Planilha corporativa como backend + tela no próprio ecossistema |
|---|---|---|---|
| Edição numa tela | Não | Sim | Sim (Apps Script web app ou Power Apps) |
| Autenticação | n/a | Construir e manter | SSO corporativo nativo |
| Onde ficam os dados | Máquina local | Contas pessoais externas | Tenant corporativo |
| Esforço até a 1ª reunião | Baixo | Alto | Médio |
| Custo / termos | Zero | Hobby = uso não comercial | Zero (licença existente) |
| Auditoria | Snapshot | Construir | Histórico nativo + log de edições |

## Decisão

**Opção C.** Planilha corporativa como armazenamento, tela de edição hospedada no próprio ecossistema
corporativo, núcleo de cálculo em Python isolado (ports & adapters).

Implementação padrão (se P1 = Google Workspace):
- **Armazenamento:** uma Google Sheet `Forecast Opex 2026` restrita ao domínio.
- **Tela:** Google Apps Script web app (HtmlService) vinculado à planilha, publicado com acesso restrito
  ao domínio, executando como o usuário que acessa. Código versionado no repositório via `clasp`.

Equivalente (se P1 = Microsoft 365): Excel no SharePoint + Power Apps (conectores padrão).

### Contrato da planilha (fonte da verdade compartilhada)

| Aba | Escrita por | Conteúdo |
|---|---|---|
| `base` | Pipeline Python (somente leitura para humanos) | chave `linha_id`, N4, projeto_curto, responsável sugerido, ORC+BG, realizado, saldo, `rodada` |
| `input` | Tela | `linha_id`, previsao_futura, classificacao, justificativa, confianca, proxima_acao, editado_por, editado_em |
| `log` | Tela (somente acréscimo) | cada salvamento: linha_id, campo, valor_anterior, valor_novo, usuário, timestamp |
| `controle` | Pipeline | rodada, hash da base, totais de controle, status da reconciliação |

### Divisão de responsabilidades

```
 Base contábil (xlsx) ─► Pipeline Python ──escreve──► aba base / controle
                              ▲                              │
                              └────lê──── aba input ◄────────┤
                                                             ▼
                                            Tela (Apps Script / Power Apps)
                                     lê base+input · edita input · grava log
 Pipeline Python ─► snapshot datado + one-pager executivo (versão oficial da reunião)
```

**Regra anti-duplicação:** regras de negócio (classificação, oportunidade ajustada, reconciliação) existem
**só** no Python. A tela faz apenas:
1. validação de preenchimento (campos obrigatórios, listas fechadas, número ≥ 0);
2. cálculo de exibição `forecast_fechamento = realizado + previsao_futura` e
   `oportunidade_ajustada = orc_bg − forecast_fechamento`, rotulado como "prévia";
3. bloqueio de edição de linhas de outro responsável (exceto perfil administrador).

O número oficial é sempre o do pipeline. Um teste de contrato garante que a prévia da tela e o Python
dão o mesmo resultado para os mesmos dados.

## Consequências

- **Positivas:** dados e login dentro da empresa; edição em tela; regras testáveis sem UI; histórico
  auditável; trocar a tela por um app web (opção B) no futuro afeta só um adaptador.
- **Negativas:** Apps Script tem limites de cota e uma experiência de desenvolvimento mais pobre;
  duas linguagens no repositório (Python + JS/Apps Script).
- **Gatilhos para migrar para B:** conflitos de edição frequentes, simulação de cenários ao vivo na
  reunião, ou uso em 2027 com mais áreas. Pré-requisitos de B: aprovação de segurança da informação,
  autenticação obrigatória desde o primeiro deploy, plano compatível com uso corporativo.

## Pendências

- **P1:** confirmar o ecossistema corporativo usado pelos responsáveis: Google Workspace ou Microsoft 365.
- **P2:** como o pipeline Python acessa a planilha. Ordem de preferência:
  (a) conta de serviço/credencial autorizada pela TI;
  (b) OAuth do próprio Gabriel rodando localmente;
  (c) troca manual de arquivo (exporta/importa CSV) como contingência.
