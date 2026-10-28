"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { salvarPrevisao } from "@/app/coleta/acoes";
import { formatarReais } from "@/lib/formato";
import { calcularPrevia } from "@/lib/previa";
import { CLASSIFICACOES, CONFIANCAS, LIMITE_JUSTIFICATIVA, LIMITE_PROXIMA_ACAO, LIMITE_RESPONSAVEL } from "@/lib/previsao-schema";
import { interpretarValor } from "@/lib/valor";
import type { LinhaColeta } from "@/server/coleta";

const ROTULO_CLASSIFICACAO: Record<(typeof CLASSIFICACOES)[number], string> = {
  COMPROMISSO: "Compromisso",
  POSTERGACAO: "Postergação",
  CANCELAMENTO: "Cancelamento",
  ECONOMIA: "Economia",
  A_VALIDAR: "A validar",
};

const ROTULO_CONFIANCA: Record<(typeof CONFIANCAS)[number], string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

type Props = {
  linha: LinhaColeta;
  nomeUsuario: string;
  aoEncerrar: (mensagem?: string) => void;
};

function valorInicialPrevisao(valor: number | null): string {
  return valor === null ? "" : valor.toFixed(2).replace(".", ",");
}

function classificacaoAtual(valor: string): (typeof CLASSIFICACOES)[number] {
  const encontrada = CLASSIFICACOES.find((c) => c === valor);
  return encontrada ?? "A_VALIDAR";
}

export function PainelEdicao({ linha, nomeUsuario, aoEncerrar }: Props) {
  const router = useRouter();
  const [pendente, iniciarEnvio] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [previsao, setPrevisao] = useState(valorInicialPrevisao(linha.previsao_futura));
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroCampo.current?.focus();
  }, []);

  const resultadoPrevia = interpretarValor(previsao);
  const previa = resultadoPrevia.ok
    ? calcularPrevia(linha.orc_bg, linha.realizado, resultadoPrevia.centavos / 100)
    : null;

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoEncerrar();
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    iniciarEnvio(async () => {
      const resultado = await salvarPrevisao(dados);
      if (resultado.ok) {
        router.refresh();
        aoEncerrar();
        return;
      }
      if (resultado.conflito) {
        router.refresh();
        aoEncerrar(resultado.mensagem);
        return;
      }
      setErros(resultado.erros ?? {});
      setMensagem(resultado.mensagem ?? null);
    });
  }

  const erroDe = (campo: string) => erros[campo];

  return (
    <div className="painel-edicao" role="dialog" aria-modal="true" aria-labelledby="painel-titulo" onKeyDown={aoTeclar}>
      <div className="painel-cabecalho">
        <div>
          <p className="eyebrow">EDITAR PREVISÃO</p>
          <h2 id="painel-titulo" className="painel-titulo">{linha.projeto}</h2>
        </div>
      </div>

      <form className="formulario-coleta" onSubmit={enviar} noValidate>
        <input type="hidden" name="linha_id" value={linha.linha_id} />
        <input type="hidden" name="versao_esperada" value={linha.versao} />

        <div className="campo">
          <label htmlFor="campo-previsao" className="campo-rotulo">Previsão futura (R$)</label>
          <input
            id="campo-previsao"
            ref={primeiroCampo}
            name="previsao_futura"
            className="campo-entrada num"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={previsao}
            onChange={(evento) => setPrevisao(evento.target.value)}
            aria-invalid={erroDe("previsao_futura") ? true : undefined}
            aria-describedby={erroDe("previsao_futura") ? "erro-previsao" : undefined}
          />
          {erroDe("previsao_futura") && (
            <p id="erro-previsao" className="campo-erro">{erroDe("previsao_futura")}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="campo-classificacao" className="campo-rotulo">Classificação</label>
          <select
            id="campo-classificacao"
            name="classificacao"
            className="campo-entrada"
            defaultValue={classificacaoAtual(linha.classificacao)}
            aria-invalid={erroDe("classificacao") ? true : undefined}
            aria-describedby={erroDe("classificacao") ? "erro-classificacao" : undefined}
          >
            {CLASSIFICACOES.map((c) => (
              <option key={c} value={c}>{ROTULO_CLASSIFICACAO[c]}</option>
            ))}
          </select>
          {erroDe("classificacao") && (
            <p id="erro-classificacao" className="campo-erro">{erroDe("classificacao")}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="campo-confianca" className="campo-rotulo">Confiança</label>
          <select
            id="campo-confianca"
            name="confianca"
            className="campo-entrada"
            defaultValue={linha.confianca ?? ""}
            aria-invalid={erroDe("confianca") ? true : undefined}
            aria-describedby={erroDe("confianca") ? "erro-confianca" : undefined}
          >
            <option value="">Não informada</option>
            {CONFIANCAS.map((c) => (
              <option key={c} value={c}>{ROTULO_CONFIANCA[c]}</option>
            ))}
          </select>
          {erroDe("confianca") && (
            <p id="erro-confianca" className="campo-erro">{erroDe("confianca")}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="campo-justificativa" className="campo-rotulo">Justificativa</label>
          <textarea
            id="campo-justificativa"
            name="justificativa"
            className="campo-entrada"
            rows={3}
            maxLength={LIMITE_JUSTIFICATIVA}
            defaultValue={linha.justificativa ?? ""}
            aria-invalid={erroDe("justificativa") ? true : undefined}
            aria-describedby={erroDe("justificativa") ? "erro-justificativa" : undefined}
          />
          {erroDe("justificativa") && (
            <p id="erro-justificativa" className="campo-erro">{erroDe("justificativa")}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="campo-proxima-acao" className="campo-rotulo">Próxima ação</label>
          <input
            id="campo-proxima-acao"
            name="proxima_acao"
            className="campo-entrada"
            maxLength={LIMITE_PROXIMA_ACAO}
            defaultValue={linha.proxima_acao ?? ""}
            aria-invalid={erroDe("proxima_acao") ? true : undefined}
            aria-describedby={erroDe("proxima_acao") ? "erro-proxima-acao" : undefined}
          />
          {erroDe("proxima_acao") && (
            <p id="erro-proxima-acao" className="campo-erro">{erroDe("proxima_acao")}</p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="campo-responsavel" className="campo-rotulo">Responsável</label>
          <input
            id="campo-responsavel"
            name="responsavel"
            className="campo-entrada"
            maxLength={LIMITE_RESPONSAVEL}
            defaultValue={linha.responsavel || nomeUsuario}
            aria-invalid={erroDe("responsavel") ? true : undefined}
            aria-describedby={erroDe("responsavel") ? "erro-responsavel" : undefined}
          />
          {erroDe("responsavel") && (
            <p id="erro-responsavel" className="campo-erro">{erroDe("responsavel")}</p>
          )}
        </div>

        <section className="previa" aria-labelledby="previa-titulo">
          <p id="previa-titulo" className="campo-rotulo">Prévia</p>
          {previa === null ? (
            <p className="campo-erro">Informe um valor válido para ver a prévia.</p>
          ) : (
            <dl className="previa-lista num">
              <div>
                <dt>Forecast de fechamento</dt>
                <dd>{formatarReais(previa.forecastFechamento)}</dd>
              </div>
              <div>
                <dt>Oportunidade</dt>
                <dd>{formatarReais(previa.oportunidade)}</dd>
              </div>
            </dl>
          )}
          <p className="previa-nota">Prévia calculada na tela. O número oficial vem da view após salvar.</p>
        </section>

        {mensagem !== null && <p className="campo-erro" role="alert">{mensagem}</p>}

        <div className="painel-acoes">
          <button type="submit" className="botao-primario" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="botao-secundario" onClick={() => aoEncerrar()} disabled={pendente}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
