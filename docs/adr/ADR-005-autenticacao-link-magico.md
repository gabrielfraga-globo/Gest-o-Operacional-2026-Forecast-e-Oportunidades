# ADR-005 — Autenticação por link mágico (Fase 2)

- **Status:** Aceito (pendência P1 abaixo)
- **Data:** 28/10/2026
- **Decisores:** Gabriel (dono do produto), Claude (arquitetura)

## Contexto

A Fase 2 abre a coleta do forecast para ~10–15 responsáveis. Precisamos saber **quem** edita cada
previsão (auditoria em `forecast_input.atualizado_por`) e **limitar a edição** às linhas de cada um.
Microsoft Entra ID dependeria da TI; senha compartilhada não identifica pessoas.

## Decisão

1. **Login por link mágico** enviado ao e-mail do usuário.
2. **Biblioteca: Better Auth** com o plugin de link mágico, sessões e usuários no próprio Postgres (Neon).
   O dono do produto escolheu "Auth.js + provedor de e-mail"; o Auth.js passou a ser mantido pela equipe
   do Better Auth, que recomenda Better Auth para projetos novos. A experiência do usuário é a mesma.
3. **Envio de e-mail por SMTP do Gmail com senha de app** (opção b), atrás de um adaptador
   `EnviadorEmail`. Trocar para domínio próprio + Resend ou SMTP corporativo muda só configuração.
4. **Lista de acesso fechada:** o link só é enviado a e-mails cadastrados na tabela `usuario`.
   Pedido de e-mail fora da lista recebe a mesma mensagem genérica ("se o e-mail estiver autorizado,
   você receberá um link"), para não revelar quem tem acesso.
5. **Papéis:** `admin` (vê e edita tudo) e `responsavel` (vê tudo; edita só o que lhe foi atribuído em
   `usuario_acesso`). A atribuição pode ser **por N4 inteiro** (`projeto_id` nulo) **ou por projeto
   específico dentro de um N4** (`projeto_id` preenchido). A permissão efetiva por linha de forecast está
   na view `vw_permissao_linha`. Um mesmo N4 pode ter várias pessoas.
6. **Autorização no servidor:** toda gravação confere sessão + papel + N4 no servidor. Esconder botões
   na tela não é controle de acesso.
7. **Todas as rotas exigem sessão**, exceto a tela de login e o callback do link.
8. Tabelas do Better Auth entram como **migration do dbmate** (SQL gerado pela CLI do Better Auth e
   revisado), para manter uma única ferramenta de schema.

## Segurança

- Link mágico de uso único, validade de 15 minutos; sessão de 7 dias com renovação.
- Limite de pedidos de link por e-mail e por IP (proteção contra spam no SMTP — Gmail tem cota diária).
- Senha de app do Gmail, `BETTER_AUTH_SECRET` e `DATABASE_URL` apenas em variáveis de ambiente
  (`app/.env.local` local, ignorado pelo Git; variáveis da Vercel em produção).
- E-mails de usuários ficam só nas tabelas `usuario` e de autenticação; a lista é carregada de um arquivo
  local fora do Git.

## Consequências

- **Positivas:** cada edição tem autor; nenhum serviço pago; trocar o envio de e-mail não afeta o resto.
- **Negativas / riscos:**
  - E-mail saindo de um Gmail pessoal pode cair em spam ou ser bloqueado pelo filtro corporativo.
    **Teste obrigatório antes da abertura:** enviar link para 2–3 responsáveis e confirmar entrega.
    Se falhar, migrar para domínio próprio + Resend.
  - Cota diária de envio do Gmail: suficiente para o volume previsto; o limitador de pedidos protege.

## Pendências

- **P1 (resolvida):** a atribuição de edição pode ser por N4 inteiro ou por projeto dentro do N4, via
  `usuario_acesso` (migration `20261028000006_usuarios.sql`). Substitui a premissa original "por N4 apenas".
