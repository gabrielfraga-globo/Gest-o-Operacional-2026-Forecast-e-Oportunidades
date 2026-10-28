# ADR-004 — Neon como sistema de registro do futuro; regras em views SQL

- **Status:** Aceito com condições (ver Segurança)
- **Data:** 27/10/2026
- **Decisores:** Gabriel (dono do produto), Claude (arquitetura)
- **Substitui:** ADR-003

## Contexto

A planilha de acompanhamento funciona como um formulário: é adequada para orçamento e realizado,
mas o futuro de cada projeto precisa ser editado livremente pelos responsáveis. O dono do produto
quer interpretar, simplificar e limpar a planilha, levá-la para um banco Postgres no Neon e, a partir
dele, abrir a coleta do futuro e montar o visual final, com app em TypeScript na Vercel.

## Decisão

1. **Papéis das fontes**
   - Planilha = fonte do orçamento e do realizado. É importada a cada rodada; o sistema nunca a edita.
   - Neon = sistema de registro do futuro (previsão, classificação, justificativa, responsável, confiança,
     próxima ação). Nenhuma planilha guarda forecast.
2. **Importação** por ETL Python executado localmente, idempotente, registrado em `import_run` com
   hash do arquivo, validação de qualidade e reconciliação com os números de controle.
3. **Regras de negócio em views SQL** (saldo, real sem orçamento, forecast, oportunidade ajustada,
   categoria, resumo por N4, reconciliação). Python e TypeScript só leem as views.
4. **Coleta e visual** em Next.js + TypeScript na Vercel (Fases 2 e 3), lendo views e gravando apenas em
   `forecast_input`, com controle de versão otimista e histórico por trigger.
5. **Migrations em SQL puro (dbmate)**, independentes de linguagem.

## Alternativas rejeitadas
- **Power Apps + SharePoint (ADR-003):** mantém os dados no tenant, mas o dono do produto quer liberdade de
  modelagem e de interface que o ecossistema low-code não oferece bem.
- **Vercel + API Graph no SharePoint:** depende de registro de app no Entra ID com consentimento do
  administrador; prazo incerto.
- **Regras em TypeScript ou em Python:** duplicaria lógica entre ETL e app. Views SQL dão uma só verdade.

## Segurança — condições de aceite
1. Repositório GitHub **privado**.
2. Projeto Neon dedicado; credenciais apenas em `.env` local e nas variáveis da Vercel; usuário de
   aplicação sem DDL, separado do usuário de migração.
3. E-mails de aprovadores não são carregados no banco; responsável identificado por nome.
4. Nenhuma rota do app sem login (decisão D6 antes da Fase 2).
5. **Risco aceito pelo dono do produto:** valores contratuais e fornecedores hospedados em serviços
   externos (Neon/Vercel) em contas fora do tenant corporativo. Recomenda-se confirmar com
   segurança da informação/compliance; o plano Hobby da Vercel é para uso não comercial.

## Consequências
- **Positivas:** liberdade total para editar o futuro; uma só fonte de regras; recarga segura do realizado
  sem perder o forecast; branches do Neon permitem testar migrations sem tocar produção.
- **Negativas:** duas linguagens no repositório; dados corporativos fora do tenant; o ETL depende do
  notebook do Gabriel (mitigado por runbook e ambiente reproduzível com `uv`).
