import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));

const URL_TESTE = process.env.DATABASE_URL_TEST;
const DBMATE_DISPONIVEL = spawnSync('dbmate', ['--version'], { encoding: 'utf8' }).status === 0;

if (!URL_TESTE) {
  console.warn('[sessao] DATABASE_URL_TEST não definida: teste de integração pulado.');
} else if (!DBMATE_DISPONIVEL) {
  console.warn('[sessao] dbmate não encontrado no PATH: teste de integração pulado.');
}

const deveRodar = Boolean(URL_TESTE) && DBMATE_DISPONIVEL;
const MIGRATIONS_DIR = path.resolve(process.cwd(), '..', 'db', 'migrations');

describe.skipIf(!deveRodar)('sessão e permissões (integração)', () => {
  const urlOriginal = process.env.DATABASE_URL;
  let sessao: typeof import('@/server/sessao');
  let permissoes: typeof import('@/server/permissoes');
  let query: typeof import('@/server/db').query;
  let encerrarPool: typeof import('@/server/db').encerrarPool;
  let linhaDoProjetoA: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TESTE;

    ({ query, encerrarPool } = await import('@/server/db'));
    sessao = await import('@/server/sessao');
    permissoes = await import('@/server/permissoes');

    await query('drop schema public cascade; create schema public;');
    const migracao = spawnSync(
      'dbmate',
      ['--migrations-dir', MIGRATIONS_DIR, '--no-dump-schema', 'up'],
      { encoding: 'utf8', env: { ...process.env, DATABASE_URL: URL_TESTE } },
    );
    if (migracao.status !== 0) {
      throw new Error(`dbmate up falhou: ${migracao.stderr}`);
    }

    const n4A = (await query<{ n4_id: number }>("insert into dim_n4 (nome) values ('N4 A') returning n4_id"))[0]!
      .n4_id;
    const projA = (
      await query<{ projeto_id: number }>(
        "insert into dim_projeto (codigo, nome_curto) values ('PRJ-A', 'Projeto A') returning projeto_id",
      )
    )[0]!.projeto_id;
    const projB = (
      await query<{ projeto_id: number }>(
        "insert into dim_projeto (codigo, nome_curto) values ('PRJ-B', 'Projeto B') returning projeto_id",
      )
    )[0]!.projeto_id;

    const linhaA = (
      await query<{ linha_id: number }>(
        "insert into forecast_linha (n4_id, projeto_id, responsavel, ativo) values ($1, $2, 'Resp', true) returning linha_id",
        [n4A, projA],
      )
    )[0]!.linha_id;
    await query(
      "insert into forecast_linha (n4_id, projeto_id, responsavel, ativo) values ($1, $2, 'Resp', true)",
      [n4A, projB],
    );
    linhaDoProjetoA = linhaA;

    await query(
      `insert into usuario (email, nome, papel, ativo) values
         ('admin@exemplo.com', 'Admin', 'admin', true),
         ('resp@exemplo.com', 'Responsável', 'responsavel', true),
         ('inativo@exemplo.com', 'Inativo', 'responsavel', false)`,
    );
    await query(
      'insert into usuario_acesso (email, n4_id, projeto_id) values ($1, $2, $3)',
      ['resp@exemplo.com', n4A, projA],
    );
  });

  afterAll(async () => {
    await encerrarPool();
    if (urlOriginal === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = urlOriginal;
    }
  });

  function sessaoDe(email: string | null) {
    mocks.getSession.mockResolvedValue(email === null ? null : { user: { email } });
  }

  it('obterUsuarioAtual devolve null sem sessão', async () => {
    sessaoDe(null);
    await expect(sessao.obterUsuarioAtual()).resolves.toBeNull();
  });

  it('obterUsuarioAtual devolve null para e-mail fora de usuario', async () => {
    sessaoDe('estranho@exemplo.com');
    await expect(sessao.obterUsuarioAtual()).resolves.toBeNull();
  });

  it('obterUsuarioAtual trata usuário inativo como sem acesso', async () => {
    sessaoDe('inativo@exemplo.com');
    await expect(sessao.obterUsuarioAtual()).resolves.toBeNull();
  });

  it('obterUsuarioAtual devolve e-mail, nome e papel de usuário ativo', async () => {
    sessaoDe('admin@exemplo.com');
    await expect(sessao.obterUsuarioAtual()).resolves.toEqual({
      email: 'admin@exemplo.com',
      nome: 'Admin',
      papel: 'admin',
    });
  });

  it('exigirSessao redireciona para /login sem sessão', async () => {
    sessaoDe(null);
    await expect(sessao.exigirSessao()).rejects.toThrow('REDIRECT:/login');
  });

  it('exigirSessao redireciona para sem-acesso quando o usuário não está autorizado', async () => {
    sessaoDe('inativo@exemplo.com');
    await expect(sessao.exigirSessao()).rejects.toThrow('REDIRECT:/login?erro=sem-acesso');
  });

  it('exigirSessao devolve o usuário quando autorizado', async () => {
    sessaoDe('resp@exemplo.com');
    await expect(sessao.exigirSessao()).resolves.toEqual({
      email: 'resp@exemplo.com',
      nome: 'Responsável',
      papel: 'responsavel',
    });
  });

  it('listarLinhasPermitidas lê vw_permissao_linha: admin vê todas, responsável só o projeto concedido', async () => {
    const admin = await permissoes.listarLinhasPermitidas('admin@exemplo.com');
    const responsavel = await permissoes.listarLinhasPermitidas('resp@exemplo.com');
    const inativo = await permissoes.listarLinhasPermitidas('inativo@exemplo.com');

    expect(admin).toHaveLength(2);
    expect(responsavel).toEqual([linhaDoProjetoA]);
    expect(inativo).toEqual([]);
  });
});
