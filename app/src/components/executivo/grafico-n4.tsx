import { formatarMilhoes } from '@/lib/formato';
import { dominioComZero, intervaloBarra } from '@/lib/graficos';
import type { ResumoN4 } from '@/server/executivo';

const LARGURA_BARRA = 400;
const ALTURA_BARRA = 16;

export function GraficoPorN4({ linhas }: { linhas: ResumoN4[] }) {
  const dominio = dominioComZero(linhas.flatMap((l) => [l.saldoBrutoPositivo, l.pressoes]));

  const resumo =
    `Saldo bruto positivo e pressões por N4: ` +
    linhas
      .map(
        (l) =>
          `${l.n4}, saldo bruto positivo ${formatarMilhoes(l.saldoBrutoPositivo)} e pressões ${formatarMilhoes(l.pressoes)}`,
      )
      .join('; ') +
    '.';

  return (
    <figure className="grafico-figura">
      <div role="img" aria-label={resumo} className="n4-grafico">
        <ul className="n4-lista">
          {linhas.map((l) => {
            const positiva = intervaloBarra(0, l.saldoBrutoPositivo, dominio, LARGURA_BARRA);
            const pressao = intervaloBarra(0, l.pressoes, dominio, LARGURA_BARRA);
            const zero = intervaloBarra(0, 0, dominio, LARGURA_BARRA).x;
            return (
              <li key={l.n4} className="n4-linha">
                <span className="n4-nome">{l.n4}</span>
                <svg
                  viewBox={`0 0 ${LARGURA_BARRA} ${ALTURA_BARRA}`}
                  width="100%"
                  preserveAspectRatio="none"
                  className="n4-barra"
                  aria-hidden="true"
                  focusable="false"
                >
                  <line x1={zero} x2={zero} y1={0} y2={ALTURA_BARRA} className="grafico-eixo" />
                  <rect
                    x={positiva.x}
                    y={2}
                    width={positiva.largura}
                    height={ALTURA_BARRA - 4}
                    fill="var(--cat-capex)"
                  />
                  <rect
                    x={pressao.x}
                    y={2}
                    width={pressao.largura}
                    height={ALTURA_BARRA - 4}
                    fill="var(--pressao)"
                  />
                </svg>
                <span className="n4-valores num">
                  <span className="n4-valor-positivo">{formatarMilhoes(l.saldoBrutoPositivo)}</span>
                  <span className="n4-valor-pressao">{formatarMilhoes(l.pressoes)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="grafico-legenda">
        <li>
          <span className="legenda-cor" style={{ background: 'var(--cat-capex)' }} aria-hidden="true" />
          Saldo bruto positivo
        </li>
        <li>
          <span className="legenda-cor" style={{ background: 'var(--pressao)' }} aria-hidden="true" />
          Pressões (lado negativo)
        </li>
      </ul>

      <details className="ver-dados">
        <summary>Ver dados</summary>
        <table className="tabela-compacta">
          <caption>Saldo bruto positivo e pressões por N4</caption>
          <thead>
            <tr>
              <th scope="col">N4</th>
              <th scope="col">Saldo bruto positivo</th>
              <th scope="col">Pressões</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.n4}>
                <th scope="row">{l.n4}</th>
                <td className="num">{formatarMilhoes(l.saldoBrutoPositivo)}</td>
                <td className="num">{formatarMilhoes(l.pressoes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
