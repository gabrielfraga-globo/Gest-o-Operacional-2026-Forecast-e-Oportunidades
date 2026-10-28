import { formatarMilhoes } from '@/lib/formato';
import { degraus, dominioComZero, posicaoNoEixo } from '@/lib/graficos';

export interface EntradaCascata {
  orcBg: number;
  realizado: number;
  forecastFechamento: number;
  oportunidade: number;
  pressao: number;
}

interface Layout {
  readonly largura: number;
  readonly altura: number;
  readonly topo: number;
  readonly plotagem: number;
  readonly barra: number;
  readonly rotulos: readonly [string, string, string, string];
}

const LAYOUT_COMPLETO: Layout = {
  largura: 560,
  altura: 260,
  topo: 28,
  plotagem: 180,
  barra: 68,
  rotulos: ['ORC+BG', 'Realizado', 'Previsão futura', 'Saldo projetado'],
};

const LAYOUT_COMPACTO: Layout = {
  largura: 360,
  altura: 300,
  topo: 36,
  plotagem: 220,
  barra: 56,
  rotulos: ['ORC+BG', 'Real.', 'Previsão', 'Saldo'],
};

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

  const resumo =
    `Cascata do forecast: ORC+BG ${formatarMilhoes(orcBg)}; ` +
    `Realizado ${formatarMilhoes(-realizado)}; ` +
    `Previsão futura ${formatarMilhoes(-(forecastFechamento - realizado))}; ` +
    `Saldo projetado ${formatarMilhoes(saldo)}, sendo Oportunidade ${formatarMilhoes(oportunidade)}, ` +
    `Pressão ${formatarMilhoes(pressao)} e Compromisso e a validar ${formatarMilhoes(residual)}.`;

  // Duas variantes do mesmo desenho: a CSS alterna qual aparece (ver globals.css).
  const desenhar = (layout: Layout, compacto: boolean) => {
    const base = layout.topo + layout.plotagem;
    const coluna = layout.largura / 4;
    const yDe = (valor: number): number => base - posicaoNoEixo(valor, dominio, layout.plotagem);
    const yZero = yDe(0);
    const xSaldo = coluna * 3 + coluna / 2;
    const semSegmentos = segmentos.every((s) => yDe(s.inicio) === yDe(s.fim));
    const pontosSaldo = segmentos.flatMap((s) => [yDe(s.inicio), yDe(s.fim)]);
    const topoSaldo = Math.min(...pontosSaldo);
    const fundoSaldo = Math.max(...pontosSaldo);
    const yRotuloSaldo = saldo < 0 ? fundoSaldo + 14 : topoSaldo - 6;

    return (
      <svg
        role="img"
        aria-label={resumo}
        viewBox={`0 0 ${layout.largura} ${layout.altura}`}
        width="100%"
        className={`grafico-svg ${compacto ? 'grafico-cascata-compacto' : 'grafico-cascata-completo'}`}
      >
        <line x1={0} x2={layout.largura} y1={yZero} y2={yZero} className="grafico-eixo" />

        {passos.slice(0, 3).map((p, i) => {
          const cx = coluna * i + coluna / 2;
          const ya = yDe(p.inicio);
          const yb = yDe(p.fim);
          const topo = Math.min(ya, yb);
          const altura = Math.max(Math.abs(yb - ya), 1);
          const valor = p.tipo === 'reducao' ? -(p.fim - p.inicio) : p.fim - p.inicio;
          return (
            <g key={p.rotulo}>
              <rect
                x={cx - layout.barra / 2}
                y={topo}
                width={layout.barra}
                height={altura}
                className={p.tipo === 'total' ? 'barra-total' : 'barra-reducao'}
              />
              <text x={cx} y={topo - 6} textAnchor="middle" className="grafico-rotulo-valor">
                {formatarMilhoes(valor)}
              </text>
              <text x={cx} y={layout.altura - 6} textAnchor="middle" className="grafico-rotulo-eixo">
                {layout.rotulos[i]}
              </text>
            </g>
          );
        })}

        {segmentos.map((s) => {
          const ya = yDe(s.inicio);
          const yb = yDe(s.fim);
          const altura = Math.abs(yb - ya);
          if (altura === 0) return null;
          return (
            <rect
              key={s.rotulo}
              x={xSaldo - layout.barra / 2}
              y={Math.min(ya, yb)}
              width={layout.barra}
              height={altura}
              style={{ fill: s.cor }}
            />
          );
        })}
        {semSegmentos && (
          <rect
            x={xSaldo - layout.barra / 2}
            y={yZero - 1}
            width={layout.barra}
            height={2}
            className="barra-total"
          />
        )}
        <text x={xSaldo} y={yRotuloSaldo} textAnchor="middle" className="grafico-rotulo-valor">
          {formatarMilhoes(saldo)}
        </text>
        <text x={xSaldo} y={layout.altura - 6} textAnchor="middle" className="grafico-rotulo-eixo">
          {layout.rotulos[3]}
        </text>
      </svg>
    );
  };

  return (
    <figure className="grafico-figura">
      {desenhar(LAYOUT_COMPLETO, false)}
      {desenhar(LAYOUT_COMPACTO, true)}

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
