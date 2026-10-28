"""Nomes curtos de projeto e leitura/escrita do CSV de aliases (codigo -> nome_curto)."""

from __future__ import annotations

import csv
import re
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

import pandas as pd

_TAMANHO_MAXIMO = 40
_RETICENCIAS = "…"
_SEPARADOR = " - "
_CABECALHO = ["codigo", "nome_curto"]
_PREPOSICOES = {"DE", "DA", "DO", "DAS", "DOS", "EM", "E", "A", "O", "NA", "NO", "PARA", "COM"}
_SUFIXO_NA = "/NA"


class AliasFaltanteError(Exception):
    def __init__(self, faltantes: list[str]) -> None:
        self.faltantes = faltantes
        super().__init__(f"Alias ausente para {len(faltantes)} projeto(s): {', '.join(faltantes)}")


_PADRAO_ORCAMENTO = re.compile(r"/(\d{4})/(CAPEX|OPEX)(/NA)*/?$", re.IGNORECASE)


def codigo_projeto(projeto: str) -> str:
    return projeto.split(_SEPARADOR, 1)[0].strip()


def tipo_orcamento(texto: str) -> str | None:
    casamento = _PADRAO_ORCAMENTO.search(texto.strip())
    if casamento is None:
        return None
    return "Capex" if casamento.group(2).upper() == "CAPEX" else "Opex"


def sugerir_nome_curto(texto: str) -> str:
    if "INDIRETO" in texto.upper():
        return "Indireto"

    nome = texto.strip()
    if _SEPARADOR in nome:
        nome = nome.split(_SEPARADOR, 1)[1]
    nome = _PADRAO_ORCAMENTO.sub("", nome.strip())
    nome = _remover_barras_finais(nome)

    palavras = [_formatar_palavra(p, primeira=i == 0) for i, p in enumerate(nome.split())]
    resultado = " ".join(palavras)
    if not resultado:
        return codigo_projeto(texto)[:_TAMANHO_MAXIMO]
    if len(resultado) > _TAMANHO_MAXIMO:
        resultado = resultado[: _TAMANHO_MAXIMO - 1].rstrip() + _RETICENCIAS
    return resultado


def sugerir_aliases(projetos: Iterable[str]) -> dict[str, str]:
    representantes: dict[str, str] = {}
    for texto in sorted(set(projetos)):
        representantes.setdefault(codigo_projeto(texto), texto)

    codigos = sorted(representantes)
    bases = {codigo: sugerir_nome_curto(representantes[codigo]) for codigo in codigos}
    tipos = {codigo: tipo_orcamento(representantes[codigo]) for codigo in codigos}
    nomes = dict(bases)

    for base, grupo in _grupos(nomes).items():
        tipos_grupo = [tipos[codigo] for codigo in grupo]
        if None not in tipos_grupo and len(set(tipos_grupo)) == len(grupo):
            for codigo in grupo:
                nomes[codigo] = _com_sufixo(base, f" · {tipos[codigo]}")

    for grupo in _grupos(nomes).values():
        for codigo in grupo:
            parte = _parte_apos_hifen(codigo)
            if parte:
                nomes[codigo] = _com_sufixo(bases[codigo], f" · {parte}")

    finais: dict[str, str] = {}
    usados: set[str] = set()
    for codigo in codigos:
        finais[codigo] = _tornar_unico(nomes[codigo], usados)
        usados.add(finais[codigo])
    return finais


def ler_aliases(caminho: Path) -> dict[str, str]:
    aliases: dict[str, str] = {}
    codigos_vistos: dict[str, int] = {}
    nomes_vistos: dict[str, int] = {}
    with caminho.open(encoding="utf-8-sig", newline="") as arquivo:
        leitor = csv.reader(arquivo)
        cabecalho = next(leitor, None)
        if cabecalho != _CABECALHO:
            raise ValueError(
                f"{caminho.name}, linha 1: cabeçalho deve ser 'codigo,nome_curto', "
                f"recebido {cabecalho!r}"
            )
        for registro in leitor:
            linha = leitor.line_num
            if len(registro) != 2:
                raise ValueError(
                    f"{caminho.name}, linha {linha}: esperadas 2 colunas, recebidas {len(registro)}"
                )
            codigo, nome = registro
            if not codigo.strip():
                raise ValueError(f"{caminho.name}, linha {linha}: codigo vazio")
            if not nome.strip():
                raise ValueError(f"{caminho.name}, linha {linha}: nome_curto vazio")
            if len(nome) > _TAMANHO_MAXIMO:
                raise ValueError(
                    f"{caminho.name}, linha {linha}: nome_curto com {len(nome)} caracteres "
                    f"(máximo {_TAMANHO_MAXIMO})"
                )
            if codigo in codigos_vistos:
                raise ValueError(
                    f"{caminho.name}, linha {linha}: codigo duplicado {codigo!r} "
                    f"(já na linha {codigos_vistos[codigo]})"
                )
            if nome in nomes_vistos:
                raise ValueError(
                    f"{caminho.name}, linha {linha}: nome_curto duplicado {nome!r} "
                    f"(já na linha {nomes_vistos[nome]})"
                )
            aliases[codigo] = nome
            codigos_vistos[codigo] = linha
            nomes_vistos[nome] = linha
    return aliases


def escrever_aliases(caminho: Path, aliases: Mapping[str, str]) -> None:
    with caminho.open("w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(_CABECALHO)
        for codigo in sorted(aliases):
            escritor.writerow([codigo, aliases[codigo]])


def aplicar_aliases(df: pd.DataFrame, aliases: Mapping[str, str]) -> pd.DataFrame:
    codigos = df["projeto"].map(_codigo_ou_nulo)
    faltantes = sorted({codigo for codigo in codigos.dropna() if codigo not in aliases})
    if faltantes:
        raise AliasFaltanteError(faltantes)

    resultado = df.copy()
    resultado["codigo_projeto"] = codigos
    resultado["projeto_curto"] = codigos.map(dict(aliases))
    return resultado


def _codigo_ou_nulo(projeto: Any) -> str | None:
    if pd.isna(projeto):
        return None
    return codigo_projeto(str(projeto))


def _remover_barras_finais(nome: str) -> str:
    nome = nome.strip()
    while True:
        if nome.upper().endswith(_SUFIXO_NA):
            nome = nome[: -len(_SUFIXO_NA)].rstrip()
        elif nome.endswith("/"):
            nome = nome[:-1].rstrip()
        else:
            return nome


def _formatar_palavra(palavra: str, *, primeira: bool) -> str:
    if any(c.isdigit() for c in palavra):
        return palavra.upper()
    letras = "".join(c for c in palavra if c.isalpha())
    if not primeira and letras.upper() in _PREPOSICOES:
        return palavra.lower()
    eh_sigla = (
        palavra.isupper()
        and 0 < len(letras) <= 3
        and letras.upper() not in _PREPOSICOES
        and not palavra.endswith(".")
    )
    if eh_sigla:
        return palavra
    return _capitalizar(palavra)


def _capitalizar(palavra: str) -> str:
    minusculo = palavra.lower()
    for i, c in enumerate(minusculo):
        if c.isalpha():
            return minusculo[:i] + c.upper() + minusculo[i + 1 :]
    return minusculo


def _com_sufixo(base: str, sufixo: str) -> str:
    limite = _TAMANHO_MAXIMO - len(sufixo)
    if len(base) > limite:
        base = base[: limite - 1].rstrip() + _RETICENCIAS
    return base + sufixo


def _grupos(nomes: Mapping[str, str]) -> dict[str, list[str]]:
    grupos: dict[str, list[str]] = {}
    for codigo, nome in nomes.items():
        grupos.setdefault(nome, []).append(codigo)
    return {nome: codigos for nome, codigos in grupos.items() if len(codigos) > 1}


def _parte_apos_hifen(codigo: str) -> str:
    partes = codigo.split("-", 1)
    return partes[1] if len(partes) == 2 else ""


def _tornar_unico(nome: str, usados: set[str]) -> str:
    if nome not in usados:
        return nome
    n = 2
    while True:
        sufixo = f" #{n}"
        candidato = nome[: _TAMANHO_MAXIMO - len(sufixo)].rstrip() + sufixo
        if candidato not in usados:
            return candidato
        n += 1
