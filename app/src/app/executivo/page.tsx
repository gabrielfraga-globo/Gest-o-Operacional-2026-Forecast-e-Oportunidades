import Link from 'next/link';
import { BotaoImprimir } from '@/components/executivo/botao-imprimir';
import { GraficoCascata } from '@/components/executivo/grafico-cascata';
import { GraficoPorN4 } from '@/components/executivo/grafico-n4';
import { formatarMilhoes, formatarPercentual, formatarReaisInteiro } from '@/lib/formato';
import { fracaoSegura } from '@/lib/graficos';
import {
  listarMaioresOportunidades,
  listarMaioresPressoes,
  listarPorCategoria,
  listarResumoN4,
  obterResumoGeral,
  type MaiorOportunidade,
  type MaiorPressao,
  type ResumoCategoria,
} from '@/server/executivo';
import { exigirSessao } from '@/server/sessao';

export const dynamic = 'force-dynamic';

const ORDEM_CATEGORIAS = ['OPORTUNIDADE', 'COMPROMISSO', 'PRESSAO', 'A_VALIDAR'] as const;
type Categoria = (typeof ORDEM_CATEGORIAS)[number];

const ROTULO_CATEGORIA: Record<Categoria, string> = {
  OPORTUNIDADE: 'Oportunidade',
  COMPROMISSO: 'Compromisso',
  PRESSAO: 'Pressão',
  A_VALIDAR: 'A validar',
};

const COR_CATEGORIA: Record<Categoria, string> = {
  OPORTUNIDADE: 'var(--oportunidade)',
  COMPROMISSO: 'var(--compromisso)',
  PRESSAO: 'var(--pressao)',
  A_VALIDAR: 'var(--a-validar)',
};

export default async function PaginaExecutivo() {
  await exigirSessao();

  const [resumo, n4, categorias, oportunidades, pressoes] = await Promise.all([
    obterResumoGeral(),
    listarResumoN4(),
    listarPorCategoria(),
    listarMaioresOportunidades(10),
    listarMaioresPressoes(10),
  ]);

  if (resumo.linhas === 0) {
    return (
      <section className="vazio" aria-labelledby="executivo-titulo">
        <p className="eyebrow">FIN. OPERACIONAL</p>
        <h1 id="executivo-titulo" className="h1 titulo-area">
          Forecast Opex 2026
        </h1>
        <p className="lead">Ainda não há linhas de forecast para exibir.</p>
      </section>
    );
  }

  const pctComInput = fracaoSegura(resumo.linhasComInput, resumo.linhas);
  const porCategoria = new Map<string, ResumoCategoria>(categorias.map((c) => [c.categoria, c]));
  const quantidadeDe = (chave: Categoria) => porCategoria.get(chave)?.quantidade ?? 0;
  const valorDe = (chave: Categoria) => porCategoria.get(chave)?.oportunidadeAjustada ?? 0;
  const rotuloLinhas = (n: number) => (n === 1 ? 'linha' : 'linhas');

  const kpis = [
    { eyebrow: 'ORC+BG', valor: formatarMilhoes(resumo.orcBg), contexto: 'Orçamento e budget gerencial' },
    { eyebrow: 'Realizado', valor: formatarMilhoes(resumo.realizado), contexto: 'Lançado até a data' },
    {
      eyebrow: 'Forecast de fechamento',
      valor: formatarMilhoes(resumo.forecastFechamento),
      contexto: 'Realizado mais previsão futura',
    },
    {
      eyebrow: 'Oportunidade ajustada',
      valor: formatarMilhoes(resumo.oportunidadeAjustada),
      contexto: 'Economias justificadas',
    },
    {
      eyebrow: 'Pressões',
      valor: formatarMilhoes(resumo.pressoes),
      contexto: `${quantidadeDe('PRESSAO')} ${rotuloLinhas(quantidadeDe('PRESSAO'))} em pressão`,
    },
  ];

  return (
    <div className="area-executivo">
      <div className="executivo-grade">
        <div className="painel-principal">
          <header className="cabecalho executivo-cabecalho">
            <div>
              <p className="eyebrow">FIN. OPERACIONAL</p>
              <h1 className="h1 titulo-area">Forecast Opex 2026</h1>
              <p className="lead">
                {formatarMilhoes(resumo.saldo)} de saldo; {formatarMilhoes(resumo.oportunidadeAjustada)}{' '}
                justificados como oportunidade e {formatarMilhoes(resumo.pressoes)} em pressão.{' '}
                {formatarPercentual(pctComInput)} das linhas com previsão.
              </p>
            </div>
            <BotaoImprimir />
          </header>

          <section className="grade-kpi executivo-kpis" aria-label="Indicadores do forecast">
            {kpis.map((kpi) => (
              <article className="card-kpi" key={kpi.eyebrow}>
                <p className="card-kpi-eyebrow">{kpi.eyebrow}</p>
                <p className="kpi num">{kpi.valor}</p>
                <p className="card-kpi-contexto">{kpi.contexto}</p>
              </article>
            ))}
          </section>

          <section className="bloco-grafico" aria-labelledby="titulo-cascata">
            <h2 id="titulo-cascata" className="bloco-titulo">
              Do orçamento ao saldo projetado
            </h2>
            <GraficoCascata
              orcBg={resumo.orcBg}
              realizado={resumo.realizado}
              forecastFechamento={resumo.forecastFechamento}
              oportunidade={valorDe('OPORTUNIDADE')}
              pressao={valorDe('PRESSAO')}
            />
          </section>

          <section className="bloco-grafico" aria-labelledby="titulo-n4">
            <h2 id="titulo-n4" className="bloco-titulo">
              Saldo e pressões por N4
            </h2>
            {n4.length > 0 ? (
              <GraficoPorN4 linhas={n4} />
            ) : (
              <p className="lead">Nenhum N4 com linhas de forecast.</p>
            )}
          </section>
        </div>

        <aside className="painel-lateral" aria-label="Status da coleta e categorias">
          <section aria-labelledby="titulo-coleta">
            <p className="eyebrow" id="titulo-coleta">
              STATUS DA COLETA
            </p>
            <p className="coleta-total num">{formatarPercentual(pctComInput)}</p>
            <p className="card-kpi-contexto">
              {resumo.linhasComInput} de {resumo.linhas} linhas com input
            </p>
            <ol className="coleta-lista">
              {n4.map((linha, indice) => {
                const fracao = fracaoSegura(linha.linhasComInput, linha.linhas);
                return (
                  <li key={linha.n4} className="coleta-item">
                    <div className="coleta-cabecalho">
                      <span>
                        <span className="coleta-numero">{String(indice + 1).padStart(2, '0')}</span>{' '}
                        {linha.n4}
                      </span>
                      <span className="num">
                        {linha.linhasComInput} / {linha.linhas}
                      </span>
                    </div>
                    <div
                      className="progresso"
                      role="progressbar"
                      aria-label={`Coleta de ${linha.n4}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(fracao * 100)}
                    >
                      <span style={{ width: `${fracao * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="titulo-categorias" className="categorias">
            <h2 id="titulo-categorias" className="bloco-titulo">
              Por categoria
            </h2>
            <div className="categorias-grade">
              {ORDEM_CATEGORIAS.map((chave) => (
                <article
                  className="subcard-categoria"
                  key={chave}
                  style={{ borderTopColor: COR_CATEGORIA[chave] }}
                >
                  <h3 className="subcard-titulo" style={{ color: COR_CATEGORIA[chave] }}>
                    {ROTULO_CATEGORIA[chave].toUpperCase()}
                  </h3>
                  <p className="num subcard-valor">{formatarMilhoes(valorDe(chave))}</p>
                  <p className="card-kpi-contexto">
                    {quantidadeDe(chave)} {rotuloLinhas(quantidadeDe(chave))}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <Link href="/coleta" className="botao-contorno">
            Abrir coleta →
          </Link>
        </aside>
      </div>

      <section className="executivo-tabelas" aria-label="Maiores movimentos">
        <TabelaLinhas
          titulo="Maiores oportunidades"
          vazio="Nenhuma linha classificada como oportunidade."
          linhas={oportunidades}
          colunaValor="Oportunidade"
          valorDe={(l) => l.oportunidadeAjustada}
        />
        <TabelaLinhas
          titulo="Maiores pressões"
          vazio="Nenhuma linha classificada como pressão."
          linhas={pressoes}
          colunaValor="Saldo"
          valorDe={(l) => l.oportunidadeAjustada}
        />
      </section>
    </div>
  );
}

type LinhaTabela = MaiorOportunidade | MaiorPressao;

function TabelaLinhas<T extends LinhaTabela>({
  titulo,
  vazio,
  linhas,
  colunaValor,
  valorDe,
}: {
  titulo: string;
  vazio: string;
  linhas: T[];
  colunaValor: string;
  valorDe: (linha: T) => number;
}) {
  const id = titulo.toLowerCase().replace(/\s+/g, '-');
  return (
    <section className="bloco-tabela" aria-labelledby={id}>
      <h2 id={id} className="bloco-titulo">
        {titulo}
      </h2>
      {linhas.length === 0 ? (
        <p className="lead">{vazio}</p>
      ) : (
        <div className="tabela-rolagem">
        <table className="tabela-compacta tabela-executiva">
          <thead>
            <tr>
              <th scope="col">N4</th>
              <th scope="col">Projeto</th>
              <th scope="col">{colunaValor}</th>
              <th scope="col">Responsável</th>
              <th scope="col">Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${l.n4}-${l.projeto}-${i}`}>
                <td>{l.n4}</td>
                <td className="celula-truncada" title={l.projeto}>
                  {l.projeto}
                </td>
                <td className="num">{formatarReaisInteiro(valorDe(l))}</td>
                <td className="celula-truncada" title={l.responsavel ?? ''}>
                  {l.responsavel ?? '—'}
                </td>
                <td className="celula-truncada" title={l.justificativa ?? ''}>
                  {l.justificativa ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
