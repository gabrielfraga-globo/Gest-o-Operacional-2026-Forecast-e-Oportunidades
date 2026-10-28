import 'server-only';
import { query } from '@/server/db';

export interface Reconciliacao {
  orcBg: number;
  realizado: number;
  saldo: number;
  utilizacao: number | null;
  realSemOrcamento: number;
  linhasRealSemOrcamento: number;
}

interface LinhaReconciliacao {
  orc_bg: string | number | null;
  realizado: string | number | null;
  saldo: string | number | null;
  utilizacao: string | number | null;
  real_sem_orcamento: string | number | null;
  linhas_real_sem_orcamento: string | number | null;
}

// Conversão de numeric/bigint (strings no pg) para number apenas para exibição.
// Não use estes valores para cálculo: as regras de negócio ficam nas views.
function paraNumero(valor: string | number | null): number {
  return valor === null ? 0 : Number(valor);
}

export async function getReconciliacao(): Promise<Reconciliacao> {
  const linhas = await query<LinhaReconciliacao>(
    'select orc_bg, realizado, saldo, utilizacao, real_sem_orcamento, linhas_real_sem_orcamento from vw_reconciliacao',
  );
  const linha = linhas[0];
  if (!linha) {
    throw new Error('vw_reconciliacao não retornou linhas.');
  }
  return {
    orcBg: paraNumero(linha.orc_bg),
    realizado: paraNumero(linha.realizado),
    saldo: paraNumero(linha.saldo),
    utilizacao: linha.utilizacao === null ? null : Number(linha.utilizacao),
    realSemOrcamento: paraNumero(linha.real_sem_orcamento),
    linhasRealSemOrcamento: paraNumero(linha.linhas_real_sem_orcamento),
  };
}
