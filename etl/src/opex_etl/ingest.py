"""Leitura da aba Base da planilha de origem para um DataFrame tipado com chave estável."""

import hashlib
import math
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from opex_etl.domain import (
    ABA_BASE,
    CAMPOS_ROW_KEY,
    COLUNAS_BASE,
    LINHA_CABECALHO,
    cen2_da_planilha,
    mes_para_int,
)

_TAMANHO_BLOCO = 1024 * 1024
# Índice 0 da tabela lida corresponde à linha 3 do Excel (cabeçalho na linha 2).
_DESLOCAMENTO_LINHA = 3

_COLUNAS_DADOS: tuple[str, ...] = tuple(COLUNAS_BASE.values())


@dataclass(frozen=True)
class ResultadoIngestao:
    caminho: Path
    sha256: str
    linhas_lidas: int
    dados: pd.DataFrame


class ErroIngestao(Exception):
    """Erro de leitura da planilha de origem, com contexto para correção."""


def sha256_arquivo(caminho: Path) -> str:
    digest = hashlib.sha256()
    with caminho.open("rb") as arquivo:
        while bloco := arquivo.read(_TAMANHO_BLOCO):
            digest.update(bloco)
    return digest.hexdigest()


def ler_base(caminho: Path) -> ResultadoIngestao:
    with pd.ExcelFile(caminho, engine="openpyxl") as planilha:
        abas = planilha.sheet_names
    if ABA_BASE not in abas:
        raise ErroIngestao(f"Aba {ABA_BASE!r} não encontrada em {caminho.name}")
    bruto = pd.read_excel(
        caminho, sheet_name=ABA_BASE, header=LINHA_CABECALHO, engine="openpyxl", dtype=object
    )

    faltantes = sorted(coluna for coluna in COLUNAS_BASE if coluna not in bruto.columns)
    if faltantes:
        raise ErroIngestao(
            f"Colunas ausentes na aba {ABA_BASE!r} de {caminho.name}: {', '.join(faltantes)}"
        )

    df = bruto.loc[:, list(COLUNAS_BASE)].rename(columns=COLUNAS_BASE)
    df["linha_planilha"] = df.index.to_numpy() + _DESLOCAMENTO_LINHA

    vazia = df[list(_COLUNAS_DADOS)].map(_celula_vazia).all(axis=1)
    df = df.loc[~vazia].copy()

    for coluna in _COLUNAS_DADOS:
        df[coluna] = df[coluna].map(_texto_ou_none)

    linhas = [int(n) for n in df["linha_planilha"]]
    df["mes"] = _converter(df["mes"].tolist(), linhas, _mes, "mês")
    df["cen2"] = _converter(df["cen2"].tolist(), linhas, _cen2, "CEN2")
    df["valor"] = pd.to_numeric(df["valor"], errors="coerce").astype(float)
    df["dt_contabilizacao"] = pd.to_datetime(df["dt_contabilizacao"], errors="coerce").dt.date

    df = df.reset_index(drop=True)
    df["row_key"] = _gerar_row_keys(df)

    return ResultadoIngestao(
        caminho=caminho,
        sha256=sha256_arquivo(caminho),
        linhas_lidas=len(df),
        dados=df,
    )


def _celula_vazia(valor: object) -> bool:
    if isinstance(valor, str):
        return not valor.strip()
    return (
        valor is None
        or valor is pd.NA
        or valor is pd.NaT
        or (isinstance(valor, float) and math.isnan(valor))
    )


def _texto_ou_none(valor: object) -> object:
    if isinstance(valor, str):
        return valor.strip() or None
    return None if _celula_vazia(valor) else valor


def _texto_obrigatorio(valor: object) -> str:
    if not isinstance(valor, str):
        raise ValueError(f"esperado texto, recebido {type(valor).__name__}")
    return valor


def _mes(valor: object) -> int:
    return mes_para_int(_texto_obrigatorio(valor))


def _cen2(valor: object) -> str:
    return cen2_da_planilha(_texto_obrigatorio(valor)).value


def _converter[T](
    valores: list[object], linhas: list[int], conversor: Callable[[object], T], rotulo: str
) -> list[T]:
    resultado: list[T] = []
    for valor, linha in zip(valores, linhas, strict=True):
        try:
            resultado.append(conversor(valor))
        except ValueError as erro:
            raise ErroIngestao(f"Linha {linha}: {rotulo} inválido {valor!r}") from erro
    return resultado


def _parte_chave(valor: object, campo: str) -> str:
    if _celula_vazia(valor):
        return ""
    if campo == "valor" and isinstance(valor, float):
        return f"{valor:.2f}"
    return str(valor)


def _gerar_row_keys(df: pd.DataFrame) -> list[str]:
    bases = [
        "|".join(_parte_chave(registro[campo], campo) for campo in CAMPOS_ROW_KEY)
        for registro in df[list(CAMPOS_ROW_KEY)].to_dict("records")
    ]
    # Conta pela string canônica: valores que colapsam no mesmo texto recebem sufixos distintos.
    ocorrencias: Counter[str] = Counter()
    chaves: list[str] = []
    for base in bases:
        n = ocorrencias[base]
        ocorrencias[base] += 1
        chaves.append(hashlib.sha1(f"{base}#{n}".encode()).hexdigest())
    return chaves
