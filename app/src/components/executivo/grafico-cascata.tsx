import { formatarMilhoes } from '@/lib/formato';
import { degraus, dominioComZero, posicaoNoEixo } from '@/lib/graficos';

export interface EntradaCascata {
  orcBg: number;
  realizado: number;
  forecastFechamento: number;
  oportunidade: number;
  pressao: number;
}

const LARGURA = 560;
const ALTURA_TOTAL = 260;
const TOPO = 28;
const ALTURA_PLOTAGEM = 180;
const BASE = TOPO + ALTURA_PLOTAGEM;
const COLUNA = LARGURA / 4;
const BARRA = 68;

export function GraficoCascata({
  orcBg,
  realizado,
  forecastFechamento,
  oportunidade,
  pressao,
}: EntradaCascata) {
  const passos = degraus(orcBg, realizado, forecastFechamento);
  const saldo = orcBg - forecastFechamento;
  const residual = saldo - oportunidade - pressao;

  const segmentos = [
    { rotulo: 'Oportunidade', valor: oportunidade, inicio: 0, fim: oportunidade, cor: 'var(--oportunidade)' },
    {
      rotulo: 'Pressão',
      valor: pressao,
      inicio: oportunidade,
      fim: oportunidade + pressao,
      cor: 'var(--pressao)',
    },
    {
      rotulo: 'Compromisso e a validar',
      valor: residual,
      inicio: oportunidade + pressao,
      fim: saldo,
      cor: 'var(--compromisso)',
    },
  ];

  const dominio = dominioComZero([
    ...passos.flatMap((p) => [p.inicio, p.fim]),
    ...segmentos.flatMap((s) => [s.inicio, s.fim]),
  ]);

  const yDe = (valor: number): number => BASE - posicaoNoEixo(valor, dominio, ALTURA_PLOTAGEM);
  const yZero = yDe(0);

  const colunas = passos.slice(0, 3);
  const xColunaSaldo = COLUNA * 3 + COLUNA / 2;
  const topoSaldo = Math.min(...segmentos.map((s) => Math.min(yDe(s.inicio), yDe(s.fim))));

  const resumo =
    `Cascata do forecast: ORC+BG ${formatarMilhoes(orcBg)}; ` +
    `Realizado ${formatarMilhoes(-realizado)}; ` +
    `Previsão futura ${formatarMilhoes(-(forecastFechamento - realizado))}; ` +
    `Saldo projetado ${formatarMilhoes(saldo)}, sendo Oportunidade ${formatarMilhoes(oportunidade)}, ` +
    `Pressão ${formatarMilhoes(pressao)} e Compromisso e a validar ${formatarMilhoes(residual)}.`;

  return (
    <figure className="grafico-figura">
      <svg
        role="img"
        aria-label={resumo}
        viewBox={`0 0 ${LARGURA} ${ALTURA_TOTAL}`}
        width="100%"
        className="grafico-svg"
      >
        <line x1={0} x2={LARGURA} y1={yZero} y2={yZero} className="grafico-eixo" />

        {colunas.map((p, i) => {
          const cx = COLUNA * i + COLUNA / 2;
          const ya = yDe(p.inicio);
          const yb = yDe(p.fim);
          const topo = Math.min(ya, yb);
          const altura = Math.max(Math.abs(yb - ya), 1);
          const valor = p.tipo === 'reducao' ? -(p.fim - p.inicio) : p.fim - p.inicio;
          return (
            <g key={p.rotulo}>
              <rect
                x={cx - BARRA / 2}
                y={topo}
                width={BARRA}
                height={altura}
                className={p.tipo === 'total' ? 'barra-total' : 'barra-reducao'}
              />
              <text x={cx} y={topo - 6} textAnchor="middle" className="grafico-rotulo-valor">
                {formatarMilhoes(valor)}
              </text>
              <text x={cx} y={ALTURA_TOTAL - 6} textAnchor="middle" className="grafico-rotulo-eixo">
                {p.rotulo}
              </text>
            </g>
          );
        })}

        {segmentos.map((s) => {
          const ya = yDe(s.inicio);
          const yb = yDe(s.fim);
          const altura = Math.abs(yb - ya);
          if (altura === 0) return null;
          const meio = (ya + yb) / 2;
          return (
            <g key={s.rotulo}>
              <rect
                x={xColunaSaldo - BARRA / 2}
                y={Math.min(ya, yb)}
                width={BARRA}
                height={altura}
                fill={s.cor}
              />
              <text x={xColunaSaldo + BARRA / 2 + 6} y={meio + 4} className="grafico-rotulo-segmento">
                {formatarMilhoes(s.valor)}
              </text>
            </g>
          );
        })}
        <text x={xColunaSaldo} y={topoSaldo - 6} textAnchor="middle" className="grafico-rotulo-valor">
          {formatarMilhoes(saldo)}
        </text>
        <text x={xColunaSaldo} y={ALTURA_TOTAL - 6} textAnchor="middle" className="grafico-rotulo-eixo">
          Saldo projetado
        </text>
      </svg>

      <ul className="grafico-legenda">
        {segmentos.map((s) => (
          <li key={s.rotulo}>
            <span className="legenda-cor" style={{ background: s.cor }} aria-hidden="true" />
            {s.rotulo}: <strong className="num">{formatarMilhoes(s.valor)}</strong>
          </li>
        ))}
      </ul>

      <details className="ver-dados">
        <summary>Ver dados</summary>
        <table className="tabela-compacta">
          <caption>Cascata do forecast</caption>
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">ORC+BG</th>
              <td className="num">{formatarMilhoes(orcBg)}</td>
            </tr>
            <tr>
              <th scope="row">Realizado</th>
              <td className="num">{formatarMilhoes(-realizado)}</td>
            </tr>
            <tr>
              <th scope="row">Previsão futura</th>
              <td className="num">{formatarMilhoes(-(forecastFechamento - realizado))}</td>
            </tr>
            <tr>
              <th scope="row">Saldo projetado</th>
              <td className="num">{formatarMilhoes(saldo)}</td>
            </tr>
            {segmentos.map((s) => (
              <tr key={s.rotulo}>
                <th scope="row">↳ {s.rotulo}</th>
                <td className="num">{formatarMilhoes(s.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
