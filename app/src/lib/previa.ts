export type Previa = {
  forecastFechamento: number;
  oportunidade: number;
};

// Prévia só de tela: o valor oficial vem da view vw_forecast após salvar.
// Cálculo em centavos inteiros para evitar erro de ponto flutuante.
export function calcularPrevia(orcBg: number, realizado: number, previsao: number): Previa {
  const emCentavos = (valor: number) => Math.round(valor * 100);
  const forecast = emCentavos(realizado) + emCentavos(previsao);
  return {
    forecastFechamento: forecast / 100,
    oportunidade: (emCentavos(orcBg) - forecast) / 100,
  };
}
