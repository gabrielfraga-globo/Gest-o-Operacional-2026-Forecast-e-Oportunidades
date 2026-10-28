import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { query } from './db';

export type Papel = 'admin' | 'responsavel';

export type UsuarioAtual = {
  email: string;
  nome: string;
  papel: Papel;
};

async function emailDaSessao(): Promise<string | null> {
  const sessao = await auth.api.getSession({ headers: await headers() });
  return sessao?.user.email ?? null;
}

async function buscarUsuarioAtivo(email: string): Promise<UsuarioAtual | null> {
  const linhas = await query<UsuarioAtual>(
    'select email, nome, papel from usuario where email = lower($1) and ativo',
    [email],
  );
  return linhas[0] ?? null;
}

export async function obterUsuarioAtual(): Promise<UsuarioAtual | null> {
  const email = await emailDaSessao();
  if (email === null) return null;
  return buscarUsuarioAtivo(email);
}

export async function exigirSessao(): Promise<UsuarioAtual> {
  const email = await emailDaSessao();
  if (email === null) redirect('/login');

  const usuario = await buscarUsuarioAtivo(email);
  if (usuario === null) redirect('/login?erro=sem-acesso');

  return usuario;
}
