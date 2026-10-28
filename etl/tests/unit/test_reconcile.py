import json
from decimal import Decimal
from pathlib import Path
from typing import Any, cast

import psycopg
import pytest

from opex_etl.reconcile import ResultadoControle, ler_controles, reconciliar, resultados_json


class _FakeCursor:
    def __init__(self, linha: tuple[Any, ...] | None) -> None:
        self._linha = linha

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._linha


class _FakeConn:
    def __init__(self, linha: tuple[Any, ...] | None) -> None:
        self._linha = linha

    def execute(self, sql: str, params: object = None) -> _FakeCursor:
        return _FakeCursor(self._linha)


def _conn_falso(linha: tuple[Any, ...] | None) -> psycopg.Connection[Any]:
    return cast(psycopg.Connection[Any], _FakeConn(linha))


def test_ler_controles_le_tolerancia_e_valores_como_decimal(tmp_path: Path) -> None:
    arquivo = tmp_path / "controls.yaml"
    arquivo.write_text(
        "tolerancia: 1.00\ncontroles:\n  orc_bg: 68623868.85\n  saldo: 13833097.93\n",
        encoding="utf-8",
    )

    tolerancia, controles = ler_controles(arquivo)

    assert tolerancia == Decimal("1.00")
    assert controles == {"orc_bg": Decimal("68623868.85"), "saldo": Decimal("13833097.93")}


def test_ler_controles_sem_tolerancia_levanta(tmp_path: Path) -> None:
    arquivo = tmp_path / "controls.yaml"
    arquivo.write_text("controles:\n  orc_bg: 1\n", encoding="utf-8")

    with pytest.raises(ValueError, match="tolerancia"):
        ler_controles(arquivo)


def test_ler_controles_sem_mapa_de_controles_levanta(tmp_path: Path) -> None:
    arquivo = tmp_path / "controls.yaml"
    arquivo.write_text("tolerancia: 1.00\n", encoding="utf-8")

    with pytest.raises(ValueError, match="controles"):
        ler_controles(arquivo)


def test_reconciliar_compara_com_tolerancia_inclusive() -> None:
    conn = _conn_falso((Decimal("100.00"), Decimal("50.00"), Decimal("50.00"), Decimal("0")))

    resultados = reconciliar(
        conn,
        Decimal("1.00"),
        {
            "orc_bg": Decimal("100.50"),
            "realizado": Decimal("48.00"),
            "saldo": Decimal("49.00"),
        },
    )

    assert [(r.nome, r.ok) for r in resultados] == [
        ("orc_bg", True),
        ("realizado", False),
        ("saldo", True),
    ]
    assert resultados[1].diferenca == Decimal("2.00")
    assert resultados[1].obtido == Decimal("50.00")


def test_reconciliar_controle_desconhecido_levanta_antes_de_consultar() -> None:
    conn = _conn_falso(None)

    with pytest.raises(ValueError, match="desconhecido"):
        reconciliar(conn, Decimal("1.00"), {"nao_existe": Decimal("1")})


def test_resultados_json_serializa_valores_como_string() -> None:
    resultados = [
        ResultadoControle("orc_bg", Decimal("10.00"), Decimal("10.50"), Decimal("0.50"), True),
        ResultadoControle("saldo", Decimal("5.00"), Decimal("9.00"), Decimal("4.00"), False),
    ]

    dados = json.loads(resultados_json(resultados))

    assert dados == [
        {"nome": "orc_bg", "esperado": "10.00", "obtido": "10.50", "diferenca": "0.50", "ok": True},
        {"nome": "saldo", "esperado": "5.00", "obtido": "9.00", "diferenca": "4.00", "ok": False},
    ]
