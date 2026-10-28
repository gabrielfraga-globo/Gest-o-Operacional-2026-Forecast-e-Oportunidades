"use client";

import { useState } from "react";
import { PainelEdicao } from "@/components/painel-edicao";
import { formatarReaisInteiro } from "@/lib/formato";
import type { LinhaColeta } from "@/server/coleta";

const ROTULO_CATEGORIA: Record<string, string> = {
  OPORTUNIDADE: "OPORTUNIDADE",
  COMPROMISSO: "COMPROMISSO",
  PRESSAO: "PRESSÃO",
  A_VALIDAR: "A VALIDAR",
};

const CLASSE_CATEGORIA: Record<string, string> = {
  OPORTUNIDADE: "pilula-oportunidade",
  COMPROMISSO: "pilula-compromisso",
  PRESSAO: "pilula-pressao",
  A_VALIDAR: "pilula-a-validar",
};

type Props = {
  linhas: LinhaColeta[];
  nomeUsuario: string;
};

export function TabelaColeta({ linhas, nomeUsuario }: Props) {
  const [editando, setEditando] = useState<LinhaColeta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState<HTMLButtonElement | null>(null);

  function abrir(linha: LinhaColeta, botao: HTMLButtonElement) {
    setAviso(null);
    setGatilho(botao);
    setEditando(linha);
  }

  function encerrar(mensagem?: string) {
    setEditando(null);
    setAviso(mensagem ?? null);
    gatilho?.focus();
  }

  return (
    <>
      {aviso !== null && (
        <p className="aviso-coleta" role="status">
          {aviso}
        </p>
      )}

      <div className="tabela-coleta-wrapper">
        <table className="tabela-coleta">
          <caption className="sr-only">Projetos do N4 com orçamento, realizado, saldo, previsão e categoria</caption>
          <thead>
            <tr>
              <th scope="col" className="projeto">Projeto</th>
              <th scope="col" className="numero">ORC+BG</th>
              <th scope="col" className="numero">Realizado</th>
              <th scope="col" className="numero">Saldo</th>
              <th scope="col" className="numero">Previsão</th>
              <th scope="col">Categoria</th>
              <th scope="col" className="acao">Ação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.linha_id}>
                <td data-rotulo="Projeto" className="projeto">
                  <span className="projeto-nome">{linha.projeto}</span>
                  <span className="projeto-codigo" title={linha.projeto_codigo}>
                    {linha.projeto_codigo}
                  </span>
                </td>
                <td data-rotulo="ORC+BG" className="numero num">{formatarReaisInteiro(linha.orc_bg)}</td>
                <td data-rotulo="Realizado" className="numero num">{formatarReaisInteiro(linha.realizado)}</td>
                <td data-rotulo="Saldo" className="numero num">{formatarReaisInteiro(linha.saldo_atual)}</td>
                <td data-rotulo="Previsão" className="numero num">
                  {linha.previsao_futura === null ? "—" : formatarReaisInteiro(linha.previsao_futura)}
                </td>
                <td data-rotulo="Categoria">
                  <span className={`pilula ${CLASSE_CATEGORIA[linha.categoria] ?? "pilula-compromisso"}`}>
                    {ROTULO_CATEGORIA[linha.categoria] ?? linha.categoria}
                  </span>
                </td>
                <td data-rotulo="Ação" className="acao">
                  {linha.pode_editar ? (
                    <button
                      type="button"
                      className="botao-secundario"
                      onClick={(evento) => abrir(linha, evento.currentTarget)}
                      aria-label={`Editar ${linha.projeto}`}
                    >
                      Editar
                    </button>
                  ) : (
                    <span className="somente-leitura">somente leitura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <PainelEdicao
          key={editando.linha_id}
          linha={editando}
          nomeUsuario={nomeUsuario}
          aoEncerrar={encerrar}
        />
      )}
    </>
  );
}
