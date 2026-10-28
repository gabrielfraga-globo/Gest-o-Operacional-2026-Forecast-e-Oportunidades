"""Testes de integração das views de regra de negócio (saldo, forecast, resumo, reconciliação)."""

from decimal import Decimal
from typing import Any

import psycopg
import pytest

REAL_SEM_ORC = "__REAL_SEM_ORC__"


def _n4(conn: psycopg.Connection, nome: str = "N4 TESTE") -> int:
    row = conn.execute("insert into dim_n4 (nome) values (%s) returning n4_id", (nome,)).fetchone()
    assert row is not None
    return int(row[0])


def _projeto(conn: psycopg.Connection, codigo: str, nome_curto: str) -> int:
    row = conn.execute(
        "insert into dim_projeto (codigo, nome_curto) values (%s, %s) returning projeto_id",
        (codigo, nome_curto),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _run(conn: psycopg.Connection) -> int:
    row = conn.execute(
        "insert into import_run (arquivo, sha256, linhas_lidas, status) "
        "values ('sintetico.xlsx', %s, 0, 'ok') returning id",
        ("d" * 64,),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _lancamento(
    conn: psycopg.Connection,
    run_id: int,
    n4_id: int,
    projeto_id: int,
    cen2: str,
    valor: str,
) -> None:
    conn.execute(
        "insert into fato_lancamento (row_key, import_run_id, cen2, cenario, n4_id, "
        "centro_custo, projeto_id, projeto_texto, conta, mes, valor, linha_planilha) "
        "values (md5(random()::text), %s, %s, %s, %s, 'CC-TESTE', %s, "
        "'P-TESTE - Projeto teste', 'CONTA-TESTE', 1, %s, 1)",
        (run_id, cen2, cen2, n4_id, projeto_id, valor),
    )


def _linha(
    conn: psycopg.Connection,
    n4_id: int,
    projeto_id: int,
    ativo: bool = True,
    responsavel: str | None = "Responsável teste",
) -> int:
    row = conn.execute(
        "insert into forecast_linha (n4_id, projeto_id, responsavel, ativo) "
        "values (%s, %s, %s, %s) returning linha_id",
        (n4_id, projeto_id, responsavel, ativo),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _input(
    conn: psycopg.Connection,
    linha_id: int,
    previsao: str,
    classificacao: str = "COMPROMISSO",
    justificativa: str | None = "Justificativa teste",
    confianca: str | None = "ALTA",
    proxima_acao: str | None = "Ação teste",
) -> None:
    conn.execute(
        "insert into forecast_input (linha_id, previsao_futura, classificacao, justificativa, "
        "confianca, proxima_acao) values (%s, %s, %s, %s, %s, %s)",
        (linha_id, previsao, classificacao, justificativa, confianca, proxima_acao),
    )


def _forecast(conn: psycopg.Connection, linha_id: int) -> dict[str, Any]:
    cur = conn.execute("select * from vw_forecast where linha_id = %s", (linha_id,))
    row = cur.fetchone()
    assert row is not None
    nomes = [col.name for col in cur.description or []]
    return dict(zip(nomes, row, strict=True))


@pytest.mark.integration
def test_saldo_linha_soma_por_cen2(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "ORC_BG", "50.00")
    _lancamento(conn, run, n4, projeto, "REAL", "30.00")

    row = conn.execute(
        "select orc_bg, realizado, saldo_atual, source_count from vw_saldo_linha "
        "where n4_id = %s and projeto_id = %s",
        (n4, projeto),
    ).fetchone()
    assert row == (Decimal("150.00"), Decimal("30.00"), Decimal("120.00"), 3)


@pytest.mark.integration
def test_real_sem_orcamento_e_reagrupado_no_projeto_especial(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    p1 = _projeto(conn, "P-1", "Projeto 1")
    p2 = _projeto(conn, "P-2", "Projeto 2")
    run = _run(conn)
    _lancamento(conn, run, n4, p1, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, p1, "REAL", "10.00")
    _lancamento(conn, run, n4, p2, "REAL", "50.00")

    rows = conn.execute(
        "select p.codigo, r.orc_bg, r.realizado, r.saldo_atual, r.source_count "
        "from vw_saldo_reagrupado r join dim_projeto p using (projeto_id) "
        "where r.n4_id = %s",
        (n4,),
    ).fetchall()
    por_codigo = {r[0]: r[1:] for r in rows}

    assert por_codigo == {
        "P-1": (Decimal("100.00"), Decimal("10.00"), Decimal("90.00"), 2),
        REAL_SEM_ORC: (Decimal("0"), Decimal("50.00"), Decimal("-50.00"), 1),
    }


@pytest.mark.integration
def test_sem_input_assume_saldo_realizado_e_categoria_a_validar(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "40.00")
    linha = _linha(conn, n4, projeto)

    f = _forecast(conn, linha)

    assert f["forecast_fechamento"] == Decimal("100.00")
    assert f["oportunidade_ajustada"] == Decimal("0")
    assert f["input_completo"] is False
    assert f["categoria"] == "A_VALIDAR"


@pytest.mark.integration
def test_estouro_sem_input_e_pressao(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "150.00")
    linha = _linha(conn, n4, projeto)

    f = _forecast(conn, linha)

    assert f["saldo_atual"] == Decimal("-50.00")
    assert f["categoria"] == "PRESSAO"


@pytest.mark.integration
def test_input_completo_com_sobra_e_oportunidade(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "40.00")
    linha = _linha(conn, n4, projeto)
    _input(conn, linha, "20.00")

    f = _forecast(conn, linha)

    assert f["input_completo"] is True
    assert f["forecast_fechamento"] == Decimal("60.00")
    assert f["oportunidade_ajustada"] == Decimal("40.00")
    assert f["categoria"] == "OPORTUNIDADE"


@pytest.mark.integration
def test_input_completo_igual_saldo_e_compromisso(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "40.00")
    linha = _linha(conn, n4, projeto)
    _input(conn, linha, "60.00")

    f = _forecast(conn, linha)

    assert f["forecast_fechamento"] == Decimal("100.00")
    assert f["oportunidade_ajustada"] == Decimal("0")
    assert f["categoria"] == "COMPROMISSO"


@pytest.mark.integration
def test_input_incompleto_continua_a_validar(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "40.00")
    linha = _linha(conn, n4, projeto)
    _input(conn, linha, "20.00", justificativa=None)

    f = _forecast(conn, linha)

    assert f["input_completo"] is False
    assert f["categoria"] == "A_VALIDAR"


@pytest.mark.integration
def test_linha_inativa_nao_aparece(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    projeto = _projeto(conn, "P-1", "Projeto 1")
    run = _run(conn)
    _lancamento(conn, run, n4, projeto, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, projeto, "REAL", "40.00")
    _linha(conn, n4, projeto, ativo=False)

    row = conn.execute("select count(*) from vw_forecast where n4_id = %s", (n4,)).fetchone()
    assert row == (0,)


@pytest.mark.integration
def test_resumo_n4_separa_bruto_e_pressoes(conn: psycopg.Connection) -> None:
    n4 = _n4(conn, "N4 RESUMO")
    p1 = _projeto(conn, "P-1", "Projeto 1")
    p2 = _projeto(conn, "P-2", "Projeto 2")
    run = _run(conn)
    _lancamento(conn, run, n4, p1, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, p1, "REAL", "40.00")
    _lancamento(conn, run, n4, p2, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, p2, "REAL", "150.00")
    _linha(conn, n4, p1)
    _linha(conn, n4, p2)

    row = conn.execute(
        "select orc_bg, realizado, saldo_liquido, saldo_bruto_positivo, pressoes, "
        "forecast_fechamento, oportunidade_ajustada, linhas, linhas_com_input, pct_com_input "
        "from vw_resumo_n4 where n4 = 'N4 RESUMO'"
    ).fetchone()

    assert row == (
        Decimal("200.00"),
        Decimal("190.00"),
        Decimal("10.00"),
        Decimal("60.00"),
        Decimal("-50.00"),
        Decimal("250.00"),
        Decimal("0"),
        2,
        0,
        Decimal("0"),
    )


@pytest.mark.integration
def test_reconciliacao_totais(conn: psycopg.Connection) -> None:
    n4 = _n4(conn)
    p1 = _projeto(conn, "P-1", "Projeto 1")
    p2 = _projeto(conn, "P-2", "Projeto 2")
    run = _run(conn)
    _lancamento(conn, run, n4, p1, "ORC_BG", "100.00")
    _lancamento(conn, run, n4, p1, "REAL", "40.00")
    _lancamento(conn, run, n4, p2, "REAL", "50.00")

    row = conn.execute(
        "select orc_bg, realizado, saldo, utilizacao, real_sem_orcamento, "
        "linhas_real_sem_orcamento from vw_reconciliacao"
    ).fetchone()

    assert row == (
        Decimal("100.00"),
        Decimal("90.00"),
        Decimal("10.00"),
        Decimal("0.9000"),
        Decimal("50.00"),
        1,
    )
