"""Testes de integração do schema (tabelas, constraints, trigger de histórico)."""

from decimal import Decimal

import psycopg
import pytest


def _n4(conn: psycopg.Connection, nome: str = "N4 TESTE") -> int:
    row = conn.execute("insert into dim_n4 (nome) values (%s) returning n4_id", (nome,)).fetchone()
    assert row is not None
    return int(row[0])


def _projeto(
    conn: psycopg.Connection, codigo: str = "P-TESTE", nome_curto: str = "Projeto teste"
) -> int:
    row = conn.execute(
        "insert into dim_projeto (codigo, nome_curto) values (%s, %s) returning projeto_id",
        (codigo, nome_curto),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _run(conn: psycopg.Connection, sha256: str = "b" * 64, status: str = "ok") -> int:
    row = conn.execute(
        "insert into import_run (arquivo, sha256, linhas_lidas, status) "
        "values ('sintetico.xlsx', %s, 0, %s) returning id",
        (sha256, status),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _fato(
    conn: psycopg.Connection,
    run_id: int,
    n4_id: int,
    projeto_id: int,
    mes: int = 1,
    valor: str = "10.00",
) -> None:
    conn.execute(
        "insert into fato_lancamento (row_key, import_run_id, cen2, cenario, n4_id, "
        "centro_custo, projeto_id, projeto_texto, conta, mes, valor, linha_planilha) "
        "values (md5(random()::text), %s, 'REAL', 'REAL', %s, 'CC-TESTE', %s, "
        "'P-TESTE - Projeto teste', 'CONTA-TESTE', %s, %s, 1)",
        (run_id, n4_id, projeto_id, mes, valor),
    )


def _linha(conn: psycopg.Connection, n4_id: int, projeto_id: int) -> int:
    row = conn.execute(
        "insert into forecast_linha (n4_id, projeto_id, responsavel) "
        "values (%s, %s, 'Responsável teste') returning linha_id",
        (n4_id, projeto_id),
    ).fetchone()
    assert row is not None
    return int(row[0])


@pytest.mark.integration
def test_tabelas_existem(conn: psycopg.Connection) -> None:
    esperadas = {
        "dim_n4",
        "dim_projeto",
        "import_run",
        "fato_lancamento",
        "forecast_linha",
        "forecast_input",
        "forecast_input_hist",
    }
    rows = conn.execute(
        "select table_name from information_schema.tables where table_schema = 'public'"
    ).fetchall()
    assert esperadas <= {r[0] for r in rows}


@pytest.mark.integration
def test_projeto_especial_existe(conn: psycopg.Connection) -> None:
    row = conn.execute(
        "select nome_curto from dim_projeto where codigo = '__REAL_SEM_ORC__'"
    ).fetchone()
    assert row == ("INDIRETO — REAL SEM ORÇAMENTO",)


@pytest.mark.integration
def test_mes_fora_do_intervalo_falha(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn)
    run = _run(conn)
    with pytest.raises(psycopg.errors.CheckViolation):
        _fato(conn, run, n4, projeto, mes=13)
    conn.rollback()


@pytest.mark.integration
def test_nome_curto_maior_que_40_falha(conn: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        _projeto(conn, nome_curto="x" * 41)
    conn.rollback()


@pytest.mark.integration
def test_previsao_negativa_falha(conn: psycopg.Connection) -> None:
    linha = _linha(conn, _n4(conn), _projeto(conn))
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "insert into forecast_input (linha_id, previsao_futura) values (%s, -1)",
            (linha,),
        )
    conn.rollback()


@pytest.mark.integration
def test_update_em_forecast_input_grava_historico_e_incrementa_versao(
    conn: psycopg.Connection,
) -> None:
    linha = _linha(conn, _n4(conn), _projeto(conn))
    conn.execute(
        "insert into forecast_input (linha_id, previsao_futura) values (%s, 10)",
        (linha,),
    )

    conn.execute("update forecast_input set previsao_futura = 20 where linha_id = %s", (linha,))
    conn.execute("update forecast_input set previsao_futura = 30 where linha_id = %s", (linha,))

    atual = conn.execute(
        "select versao, previsao_futura, atualizado_em from forecast_input where linha_id = %s",
        (linha,),
    ).fetchone()
    assert atual is not None
    assert atual[0] == 3
    assert atual[1] == Decimal("30")
    assert atual[2] is not None

    historico = conn.execute(
        "select versao, (dados->>'previsao_futura')::numeric "
        "from forecast_input_hist where linha_id = %s order by versao",
        (linha,),
    ).fetchall()
    assert historico == [(1, Decimal("10")), (2, Decimal("20"))]


@pytest.mark.integration
def test_sha256_ok_duplicado_falha_mas_failed_duplicado_passa(conn: psycopg.Connection) -> None:
    sha = "c" * 64
    _run(conn, sha256=sha, status="ok")
    with pytest.raises(psycopg.errors.UniqueViolation):
        _run(conn, sha256=sha, status="ok")
    conn.rollback()

    _run(conn, sha256=sha, status="failed")
    _run(conn, sha256=sha, status="failed")
    row = conn.execute("select count(*) from import_run where sha256 = %s", (sha,)).fetchone()
    assert row == (2,)
