"""Reconciliação: compara a vw_reconciliacao com os números de controle da planilha de origem."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg
import yaml

_COLUNAS_CONTROLE: tuple[str, ...] = ("orc_bg", "realizado", "saldo", "real_sem_orcamento")


@dataclass(frozen=True)
class ResultadoControle:
    nome: str
    esperado: Decimal
    obtido: Decimal
    diferenca: Decimal
    ok: bool


def ler_controles(caminho: Path) -> tuple[Decimal, dict[str, Decimal]]:
    with caminho.open(encoding="utf-8") as arquivo:
        conteudo = yaml.safe_load(arquivo)
    if not isinstance(conteudo, dict) or "tolerancia" not in conteudo:
        raise ValueError(f"{caminho.name}: esperado a chave 'tolerancia'")
    controles = conteudo.get("controles")
    if not isinstance(controles, dict):
        raise ValueError(f"{caminho.name}: esperado a chave 'controles' com um mapa nome: valor")
    tolerancia = Decimal(str(conteudo["tolerancia"]))
    return tolerancia, {str(nome): Decimal(str(valor)) for nome, valor in controles.items()}


def reconciliar(
    conn: psycopg.Connection[Any],
    tolerancia: Decimal,
    controles: Mapping[str, Decimal],
) -> list[ResultadoControle]:
    desconhecidos = sorted(set(controles) - set(_COLUNAS_CONTROLE))
    if desconhecidos:
        raise ValueError(f"Controle(s) desconhecido(s): {', '.join(desconhecidos)}")

    linha = conn.execute(
        "select orc_bg, realizado, saldo, real_sem_orcamento from vw_reconciliacao"
    ).fetchone()
    if linha is None:
        raise RuntimeError("vw_reconciliacao não retornou linha")
    obtidos = {
        nome: Decimal(str(valor)) for nome, valor in zip(_COLUNAS_CONTROLE, linha, strict=True)
    }

    resultados: list[ResultadoControle] = []
    for nome, esperado in controles.items():
        obtido = obtidos[nome]
        diferenca = obtido - esperado
        resultados.append(
            ResultadoControle(nome, esperado, obtido, diferenca, abs(diferenca) <= tolerancia)
        )
    return resultados


def resultados_json(resultados: list[ResultadoControle]) -> str:
    return json.dumps(
        [
            {
                "nome": r.nome,
                "esperado": str(r.esperado),
                "obtido": str(r.obtido),
                "diferenca": str(r.diferenca),
                "ok": r.ok,
            }
            for r in resultados
        ],
        ensure_ascii=False,
    )
