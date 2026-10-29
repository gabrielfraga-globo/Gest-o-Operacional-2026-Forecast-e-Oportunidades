# Deploy na Vercel — passo a passo para o dono do produto

Este guia publica o app `app/` na Vercel, com banco Neon (região sa-east-1) e e-mail via Gmail.
Nenhum valor secreto deve ser colocado em arquivo versionado: todos entram no painel da Vercel ou no seu cofre.

Ordem recomendada: (1) contas e credenciais, (2) migrations no Neon, (3) importar na Vercel, (4) carga de usuários, (5) teste de e-mail, (6) checklist pós-deploy.

---

## 1. Pré-requisitos

- Conta na Vercel conectada ao repositório GitHub.
- Projeto Neon criado na região sa-east-1 (São Paulo), com o banco de produção.
- Conta Google com verificação em duas etapas ativa (necessária para senha de app do Gmail).
- Node 22 (o projeto usa Node 22 na Vercel; configure em **Settings > General > Node.js Version**).
- Ferramenta `dbmate` e `uv` na sua máquina, para aplicar migrations e carregar usuários.

---

## 2. Aplicar as migrations no Neon (antes do primeiro deploy)

As migrations ficam em `db/migrations/` e são aplicadas com `dbmate`.

1. No painel do Neon, copie a **connection string direta** (sem `-pooler` no host) do banco de produção. Ela é usada para DDL.
2. Na sua máquina, defina a variável apenas no terminal (não grave em arquivo):
   - PowerShell: `$env:DATABASE_URL = "<connection string direta, com sslmode=require>"`
3. Na raiz do repositório:
   - `cd db`
   - `dbmate --migrations-dir ./migrations up`
4. Confirme que todas as migrations foram aplicadas, incluindo `20261028000007_better_auth` e `20261028000008_rate_limit`:
   - `dbmate --migrations-dir ./migrations status`

Se uma migration falhar, não avance para o deploy: corrija a causa e rode `up` de novo.

---

## 3. Importar o projeto na Vercel

1. Na Vercel, clique em **Add New > Project** e selecione o repositório.
2. Configure:
   - **Root Directory**: `app`
   - **Framework Preset**: Next.js
   - **Node.js Version**: 22
   - **Region**: `gru1` já vem do arquivo `app/vercel.json`. Não altere.
3. Antes de clicar em **Deploy**, cadastre as variáveis de ambiente (seção 4).

---

## 4. Variáveis de ambiente (Settings > Environment Variables)

O app valida essas variáveis ao iniciar e no build. Se alguma faltar, o build falha e a mensagem lista os **nomes** das ausentes, nunca os valores.

| Variável | Obrigatória em produção | Descrição | Onde obter |
|---|---|---|---|
| `DATABASE_URL` | Sim | Connection string do Neon **com pooling**: host contendo `-pooler`, com `?sslmode=require`. | Painel do Neon > Connect > marque **Pooled connection**. |
| `BETTER_AUTH_SECRET` | Sim (mín. 32 caracteres) | Segredo de assinatura das sessões. Nunca reutilize entre ambientes. | Gere um valor aleatório longo (ex.: `npx auth@latest secret` numa máquina local; copie só o resultado para a Vercel). |
| `BETTER_AUTH_URL` | Sim | URL pública do app, com `https://`, sem barra final. Ex.: `https://opex.seudominio.com`. | Domínio que você atribuir ao projeto na Vercel. Na primeira vez, use a URL `*.vercel.app` que a Vercel mostrar. |
| `SMTP_HOST` | Sim | Servidor SMTP. Para Gmail: `smtp.gmail.com`. | Fixo para Gmail. |
| `SMTP_PORT` | Sim | Porta SMTP. Para Gmail com SSL: `465`. | Fixo para Gmail. |
| `SMTP_USER` | Sim | Endereço Gmail que envia os e-mails. | Sua conta Google remetente. |
| `SMTP_PASS` | Sim | Senha de app do Gmail (16 caracteres), não a senha da conta. | Seção 5 abaixo. |
| `EMAIL_FROM` | Sim | Remetente exibido. Ex.: `Opex <seu.email@gmail.com>`. | Escolha o nome de exibição. |

Marque cada variável para o ambiente **Production** (e **Preview**, se quiser testar previews). Em desenvolvimento local o SMTP é opcional; o link de acesso aparece no console do servidor.

---

## 5. Criar a senha de app do Gmail

1. Acesse https://myaccount.google.com/security e ative a **verificação em duas etapas**.
2. Acesse https://myaccount.google.com/apppasswords.
3. Crie uma senha de app (nome sugerido: `Opex Vercel`).
4. Copie os 16 caracteres para a variável `SMTP_PASS` na Vercel. Não salve em arquivo nem em e-mail.

---

## 6. Primeiro deploy

1. Clique em **Deploy**. Aguarde o build terminar.
2. Se o build falhar com "Variáveis de ambiente obrigatórias ausentes", volte à seção 4, confira os nomes e refaça o deploy.
3. Ao concluir, anote a URL do deploy. Se usar domínio próprio, atualize `BETTER_AUTH_URL` com a URL final e faça um novo deploy.

---

## 7. Carregar a lista de usuários

A lista de acesso (usuários e permissões) é carregada pela CLI do ETL, direto no Neon.

1. Na sua máquina, defina `DATABASE_URL` no terminal (pode ser a URL com pooling). Não grave em arquivo.
2. Na pasta `etl`:
   - `uv run opex-etl usuarios <caminho-da-planilha-ou-csv-de-usuarios>`
3. A CLI informa quantos usuários e acessos foram carregados.

O arquivo de usuários contém dados reais: mantenha-o fora do Git.

---

## 8. Teste de entrega do e-mail

Antes de liberar para todos:

1. Escolha 2 ou 3 pessoas da lista de usuários, incluindo uma conta Gmail e uma de outro provedor (ex.: Outlook).
2. Cada uma acessa a URL do app e pede o link de acesso pelo e-mail.
3. Confirme: o e-mail chega (caixa de entrada ou spam), o link abre o app já autenticado e o remetente é o `EMAIL_FROM`.
4. Limite: o pedido de link é limitado a 3 tentativas a cada 300 segundos por endereço. Para repetir o teste, aguarde 5 minutos.

Se o e-mail não chegar, verifique os logs da função na Vercel (**Logs**) e a senha de app.

---

## 9. Checklist pós-deploy

Marque cada item na URL de produção:

- [ ] `GET /api/saude` responde `{"ok":true}` com status 200. Se responder 503, o app não alcança o banco: confira `DATABASE_URL` (host `-pooler`, `sslmode=require`).
- [ ] Página de login abre em HTTPS, sem erro no console.
- [ ] Login por link: e-mail recebido, link autentica, sessão persiste ao recarregar.
- [ ] Não existe tela ou rota de cadastro. Só usuários da lista carregada entram.
- [ ] Coleta: um usuário com perfil de coleta consegue registrar um lançamento de teste e ele aparece na tela.
- [ ] Executivo: a página carrega os indicadores e o gráfico de cascata.
- [ ] Celular (largura abaixo de 640px): o gráfico de cascata mostra os valores sem cortes e o alternador de tema fica no fim da página, sem cobrir conteúdo.
- [ ] Cabeçalhos: no DevTools, a resposta da página inclui `Strict-Transport-Security`, `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff`.

Depois do teste, remova os lançamentos de teste pelo fluxo que o app oferece, ou peça ao administrador do banco para removê-los.

---

## 10. Como reverter

Se um deploy novo quebrar o app:

1. Na Vercel, abra **Deployments**.
2. Localize o último deploy que funcionava.
3. Clique nos três pontos e escolha **Promote to Production**.

A reversão de código não desfaz migrations. Se a migration nova causou o problema, avalie com o time antes de aplicar `dbmate down`.

---

## Observações técnicas

- **Sessões seguras**: com `BETTER_AUTH_URL` em `https://`, o Better Auth marca os cookies como `Secure` automaticamente. Não há configuração extra.
- **Origens confiáveis**: o Better Auth aceita requisições apenas da origem definida em `BETTER_AUTH_URL`.
- **Limite de tentativas**: o contador fica no Neon (tabela `rateLimit`), então vale para todas as instâncias da Vercel.
- **Pooling**: o pool de conexões por instância é limitado a 5, com timeouts de 10 segundos. A Vercel pode ter várias instâncias; o pooling do Neon absorve as conexões.
- **Build**: `next build` roda em modo de produção, então as variáveis da seção 4 precisam existir também no build da Vercel.
- **Desenvolvimento local**: exige `DATABASE_URL`, `BETTER_AUTH_SECRET` (mín. 32 caracteres) e `BETTER_AUTH_URL`. SMTP continua opcional.
