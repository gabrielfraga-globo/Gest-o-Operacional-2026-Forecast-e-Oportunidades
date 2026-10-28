"""Regras de qualidade sobre o DataFrame da aba Base, sem alterar os dados de origem."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from opex_etl.domain import COLUNAS_OBRIGATORIAS, Severidade

_MAX_LINHAS_AMOSTRA = 20


@dataclass(frozen=True)
class Problema:
    severidade: Severidade
    regra: str
    mensagem: str
    linhas: tuple[int, ...]


def validar(df: pd.DataFrame) -> list[Problema]:
    problemas: list[Problema] = []

    for coluna in COLUNAS_OBRIGATORIAS:
        if coluna == "valor":
            continue
        mascara = df[coluna].isna()
        n = int(mascara.sum())
        if n:
            problemas.append(
                Problema(
                    Severidade.ERROR,
                    "OBRIGATORIO_NULO",
                    f"{n} linha(s) sem {coluna}",
                    _linhas(df, mascara),
                )
            )

    mascara_valor = df["valor"].isna()
    n_valor = int(mascara_valor.sum())
    if n_valor:
        problemas.append(
            Problema(
                Severidade.WARN,
                "VALOR_NULO",
                f"{n_valor} lançamento(s) sem valor; tratados como 0",
                _linhas(df, mascara_valor),
            )
        )

    mascara_origem = df["origem"].isna()
    n_origem = int(mascara_origem.sum())
    if n_origem:
        soma = float(df.loc[mascara_origem, "valor"].sum())
        problemas.append(
            Problema(
                Severidade.WARN,
                "ORIGEM_NULA",
                f"{n_origem} linha(s) sem origem; soma dos valores: {soma:.2f}",
                _linhas(df, mascara_origem),
            )
        )

    repetida = df["row_key"].duplicated(keep="first")
    n_repetida = int(repetida.sum())
    if n_repetida:
        problemas.append(
            Problema(
                Severidade.ERROR,
                "ROW_KEY_DUPLICADA",
                f"{n_repetida} chave(s) duplicada(s)",
                _linhas(df, repetida),
            )
        )

    cen2 = df["cen2"]
    cenario = df["cenario"]
    incoerente = (cen2.eq("REAL") & cenario.notna() & cenario.ne("REALIZADO")) | (
        cen2.eq("ORC_BG") & cenario.eq("REALIZADO")
    )
    n_incoerente = int(incoerente.sum())
    if n_incoerente:
        problemas.append(
            Problema(
                Severidade.ERROR,
                "CENARIO_INCOERENTE",
                f"{n_incoerente} linha(s) com cenário incoerente com CEN2",
                _linhas(df, incoerente),
            )
        )

    return problemas


def aplicar_correcoes(df: pd.DataFrame) -> pd.DataFrame:
    corrigido = df.copy()
    corrigido["valor"] = corrigido["valor"].fillna(0.0).astype(float).round(2)
    return corrigido


def tem_erro(problemas: list[Problema]) -> bool:
    return any(p.severidade is Severidade.ERROR for p in problemas)


def relatorio_markdown(problemas: list[Problema], linhas_lidas: int, sha256: str) -> str:
    partes = [
        "# Relatório de qualidade",
        "",
        f"- Linhas lidas: {linhas_lidas}",
        f"- SHA-256: {sha256}",
        "",
    ]
    if not problemas:
        partes.append("Nenhum problema encontrado.")
    else:
        partes.append("| Severidade | Regra | Mensagem | Linhas (amostra) |")
        partes.append("|---|---|---|---|")
        for p in problemas:
            amostra = ", ".join(str(linha) for linha in p.linhas)
            partes.append(f"| {p.severidade.value} | {p.regra} | {p.mensagem} | {amostra} |")
    return "\n".join(partes) + "\n"


def _linhas(df: pd.DataFrame, mascara: pd.Series[bool]) -> tuple[int, ...]:
    selecionadas = df.loc[mascara, "linha_planilha"].head(_MAX_LINHAS_AMOSTRA)
    return tuple(int(linha) for linha in selecionadas)
