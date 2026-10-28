# Playbook — Fase 2 (coleta) e Fase 3 (visual executivo)

Mesmo ciclo da Fase 1: um pacote por branch, um chat novo do Copilot por pacote, modelo 0x,
revisão do arquiteto direto na pasta antes do commit.

## Arquitetura da aplicação

```
app/                         Next.js (App Router) + TypeScript strict, Node 22 LTS, npm
├── src/app/                 rotas: /login, / (início), /coleta/[n4], /executivo
├── src/components/          componentes visuais do padrão COE · Performance
├── src/styles/tokens.css    tokens de cor e tipografia (docs/design/coe-performance-pattern)
├── src/server/              só servidor ("server-only"): db.ts, consultas, autorização, e-mail
└── tests/                   vitest (unidade) + integração com Postgres (DATABASE_URL_TEST)
```

Regras:
- **Leitura só pelas views** (`vw_forecast`, `vw_resumo_n4`, `vw_reconciliacao`). Nenhuma regra de negócio
  recalculada em TypeScript (ADR-004). A prévia na tela de edição é rotulada "prévia".
- **Gravação só em `forecast_input`**, sempre com conferência de sessão, papel e N4 no servidor (ADR-005),
  e controle otimista por `versao` (se outra pessoa salvou antes, a tela avisa e recarrega).
- Acesso ao banco com `pg` (node-postgres), consultas parametrizadas, nunca SQL concatenado.
- Valores em reais formatados no padrão brasileiro; números tabulares.
- Visual conforme `docs/design/coe-performance-pattern/` (tema escuro padrão, cor de área Fin. Operacional).

## Pacotes

| Pacote | Conteúdo | Depende de |
|---|---|---|
| **D** | Esqueleto do app, tokens visuais, layout, conexão ao banco, página inicial com os controles reais, CI do app | — |
| **E** | Better Auth com link mágico (Gmail SMTP), tabelas `usuario`/`usuario_n4`, proteção de rotas, comando para carregar a lista de acesso | D, ADR-005 P1 |
| **F** | Tela de coleta: navegação por N4, tabela de projetos, edição com prévia, autorização por N4, versão otimista | E |
| **G** | Visual executivo (página de área Fin. Operacional): KPIs, barras por N4, cascata, status da coleta | D |
| **H** | Deploy na Vercel (região São Paulo), variáveis de ambiente, teste de entrega do e-mail, abertura para os responsáveis | E, F, G |

## Pré-requisito na máquina (uma vez)

```powershell
winget install OpenJS.NodeJS.LTS
# feche e abra o terminal
node --version   # v22.x
npm --version
```

## Pacote D — prompt

Branch: `pacote-d-app`

```
Leia .github/copilot-instructions.md, docs/ARCHITECTURE.md (seção 3), docs/adr/ADR-004-*.md, docs/PLAYBOOK_FASE2.md (seção "Arquitetura da aplicação") e docs/design/coe-performance-pattern/pattern.md com references/typography.md e references/page-templates.md. Este pacote cria o app web na pasta app/. Duas partes; rode as verificações ao fim de cada uma.

===== PARTE 1 — Esqueleto e quality gates =====
1. Crie app/ com Next.js (versão estável atual, App Router, TypeScript, src/, sem Tailwind, sem pasta pages/), gerenciado por npm (package-lock.json versionado). Node 22 ("engines": { "node": ">=22" }).
2. tsconfig com "strict": true e "noUncheckedIndexedAccess": true. ESLint com a configuração do Next. Prettier com printWidth 100.
3. Vitest para testes (app/tests/unit e app/tests/integration). Scripts no package.json: dev, build, start, lint, typecheck ("tsc --noEmit"), test ("vitest run"), check (lint + typecheck + test em sequência).
4. app/.env.example com DATABASE_URL e DATABASE_URL_TEST comentados (mesmo texto do .env.example da raiz). Confirme que app/.env.local está coberto pelo .gitignore da raiz (regra .env.*); NÃO altere o .gitignore — se não estiver coberto, avise no final.
5. .github/workflows/ci.yml: ACRESCENTE um segundo job "app" (não altere o job existente): ubuntu-latest, mesmo serviço postgres:16, actions/setup-node com Node 22 e cache npm, working-directory app: npm ci, npm run lint, npm run typecheck, npm test, npm run build. O job deve aplicar as migrations com dbmate antes dos testes (mesmo passo condicional do job existente) e exportar DATABASE_URL_TEST.

===== PARTE 2 — Visual base, banco e página inicial =====
6. app/src/styles/tokens.css: variáveis CSS do pattern.md seção 4 (--bg, --surface, --border, --surface-active, --text, --text-muted, --text-subtle, --brand, --brand-tint, --area-bg, as 5 cores de área, semânticas oportunidade/pressao/a-validar/compromisso) e a escala tipográfica de references/typography.md. Tema escuro como padrão em :root; tema claro em [data-theme="light"] com valores provisórios legíveis (fundo claro, texto escuro, mesmas cores de área) e um comentário "TODO: confirmar paleta clara no site".
7. Fonte Plus Jakarta Sans pesos 500/700/800 via next/font/google, aplicada em todo o app. Numerais tabulares nas classes de valores.
8. Layout raiz (app/src/app/layout.tsx): navegação em pílula centralizada no topo com "Início", "Coleta", "Visão executiva" (item ativo destacado, conforme pattern.md seção 6); alternador de tema fixo no canto inferior esquerdo (escuro/claro, guardado em localStorage com try/catch; padrão escuro); lang="pt-BR".
9. app/src/server/db.ts com import "server-only": pool do pg usando process.env.DATABASE_URL (erro claro se ausente, sem imprimir a URL); função query<T>(sql, params) parametrizada.
10. app/src/server/reconciliacao.ts: getReconciliacao() lê "select orc_bg, realizado, saldo, utilizacao, real_sem_orcamento, linhas_real_sem_orcamento from vw_reconciliacao" e devolve números (converta numeric -> number só na borda, documentando que é para exibição).
11. app/src/lib/formato.ts: formatarReais(valor) -> "R$ 68.623.868,85"; formatarMilhoes(valor) -> "R$ 68,6 mi"; formatarPercentual(0.7984) -> "79,8%". Puras, sem dependência de servidor.
12. Página inicial (app/src/app/page.tsx, Server Component): eyebrow "FIN. OPERACIONAL", título "Forecast Opex 2026" na cor --cat-fin-operacional (estilo título de área), e 5 cards de KPI (ORC+BG, Realizado, Saldo, Utilização, Real sem orçamento) com eyebrow -> valor -> linha de contexto, lendo getReconciliacao(). Estados: carregando (app/src/app/loading.tsx com esqueletos do tamanho dos cards) e erro (app/src/app/error.tsx com card de erro e botão "Tentar de novo"). As páginas /coleta e /executivo existem como placeholders com o estado vazio do padrão ("Em construção").
13. Testes: tests/unit/formato.test.ts (valores positivos, negativos, zero, arredondamento); tests/integration/reconciliacao.test.ts que, com DATABASE_URL_TEST, cria dados mínimos (aplique as migrations antes, como no CI; pule o teste com mensagem clara se DATABASE_URL_TEST não existir) e confere getReconciliacao().

Não faça: login (Pacote E), telas de coleta ou executivo reais (F e G), gravação no banco, Tailwind ou biblioteca de componentes, alterações em etl/, db/migrations/ ou docs/. Nenhuma credencial em código.
Pronto quando: em app/, "npm run check" e "npm run build" passam. Liste arquivos criados e desvios.
```

Para rodar localmente depois do pacote: crie `app\.env.local` com a mesma `DATABASE_URL` do `etl\.env`
e rode `npm run dev` dentro de `app`; a página inicial deve mostrar os 4 controles reais.
