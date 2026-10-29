import 'server-only';
import { obterAmbiente } from './ambiente';
import { query } from './db';
import { enviarLinkAcesso } from './email';
import { montarUrlConfirmacao } from './url-confirmacao';

type UsuarioAtivo = { nome: string };

export async function enviarLinkMagico(email: string, url: string): Promise<void> {
  const destino = email.trim().toLowerCase();
  const usuarios = await query<UsuarioAtivo>(
    'select nome from usuario where email = lower($1) and ativo',
    [destino],
  );
  const usuario = usuarios[0];
  if (!usuario) {
    return;
  }
  await enviarLinkAcesso(destino, usuario.nome, montarUrlConfirmacao(url, obterAmbiente().authUrl));
}
