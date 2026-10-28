import 'server-only';
import { query } from './db';

// Linhas de forecast_linha que o usuário pode editar, conforme vw_permissao_linha.
export async function listarLinhasPermitidas(email: string): Promise<number[]> {
  const linhas = await query<{ linha_id: number }>(
    'select linha_id from vw_permissao_linha where email = lower($1) order by linha_id',
    [email],
  );
  return linhas.map((linha) => linha.linha_id);
}
