"""Testes de integração do controle de acesso (usuario, usuario_acesso, vw_permissao_linha)."""

import psycopg
import pytest

pytestmark = pytest.mark.integration


def _n4(conn: psycopg.Connection, nome: str) -> int:
    row = conn.execute("insert into dim_n4 (nome) values (%s) returning n4_id", (nome,)).fetchone()
    assert row is not None
    return int(row[0])


def _projeto(conn: psycopg.Connection, codigo: str) -> int:
    row = conn.execute(
        "insert into dim_projeto (codigo, nome_curto) values (%s, %s) returning projeto_id",
        (codigo, f"Projeto {codigo}"),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _linha(conn: psycopg.Connection, n4_id: int, projeto_id: int, ativo: bool = True) -> int:
    row = conn.execute(
        "insert into forecast_linha (n4_id, projeto_id, responsavel, ativo) "
        "values (%s, %s, 'Responsável teste', %s) returning linha_id",
        (n4_id, projeto_id, ativo),
    ).fetchone()
    assert row is not None
    return int(row[0])


def _usuario(conn: psycopg.Connection, email: str, papel: str, ativo: bool = True) -> None:
    conn.execute(
        "insert into usuario (email, nome, papel, ativo) values (%s, %s, %s, %s)",
        (email, "Usuário teste", papel, ativo),
    )


def _acesso(
    conn: psycopg.Connection, email: str, n4_id: int, projeto_id: int | None = None
) -> None:
    conn.execute(
        "insert into usuario_acesso (email, n4_id, projeto_id) values (%s, %s, %s)",
        (email, n4_id, projeto_id),
    )


def _linhas_visiveis(conn: psycopg.Connection, email: str) -> set[int]:
    rows = conn.execute(
        "select linha_id from vw_permissao_linha where email = %s", (email,)
    ).fetchall()
    return {int(r[0]) for r in rows}


@pytest.fixture
def cenario(conn: psycopg.Connection) -> dict[str, int]:
    """Dois N4; N4 A com dois projetos (uma linha inativa) e N4 B com uma linha."""
    n4_a = _n4(conn, "N4 A")
    n4_b = _n4(conn, "N4 B")
    p1 = _projeto(conn, "P1")
    p2 = _projeto(conn, "P2")
    p3 = _projeto(conn, "P3")
    return {
        "n4_a": n4_a,
        "n4_b": n4_b,
        "p1": p1,
        "p2": p2,
        "linha_a1": _linha(conn, n4_a, p1),
        "linha_a2": _linha(conn, n4_a, p2),
        "linha_a_inativa": _linha(conn, n4_a, p3, ativo=False),
        "linha_b1": _linha(conn, n4_b, p3),
    }


def test_admin_ve_todas_as_linhas_ativas(conn: psycopg.Connection, cenario: dict[str, int]) -> None:
    _usuario(conn, "admin@exemplo.com", "admin")

    assert _linhas_visiveis(conn, "admin@exemplo.com") == {
        cenario["linha_a1"],
        cenario["linha_a2"],
        cenario["linha_b1"],
    }


def test_responsavel_com_acesso_ao_n4_ve_todas_as_linhas_do_n4(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    _usuario(conn, "resp@exemplo.com", "responsavel")
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"])

    assert _linhas_visiveis(conn, "resp@exemplo.com") == {
        cenario["linha_a1"],
        cenario["linha_a2"],
    }


def test_responsavel_com_acesso_a_projeto_ve_so_aquela_linha(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    _usuario(conn, "resp@exemplo.com", "responsavel")
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"], cenario["p1"])

    assert _linhas_visiveis(conn, "resp@exemplo.com") == {cenario["linha_a1"]}


def test_usuario_inativo_nao_ve_nada(conn: psycopg.Connection, cenario: dict[str, int]) -> None:
    _usuario(conn, "inativo@exemplo.com", "admin", ativo=False)
    _usuario(conn, "resp@exemplo.com", "responsavel", ativo=False)
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"])

    assert _linhas_visiveis(conn, "inativo@exemplo.com") == set()
    assert _linhas_visiveis(conn, "resp@exemplo.com") == set()


def test_linha_inativa_nao_aparece_para_admin(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    _usuario(conn, "admin@exemplo.com", "admin")

    assert cenario["linha_a_inativa"] not in _linhas_visiveis(conn, "admin@exemplo.com")


def test_linha_inativa_nao_aparece_para_responsavel_do_n4(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    _usuario(conn, "resp@exemplo.com", "responsavel")
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"])

    assert cenario["linha_a_inativa"] not in _linhas_visiveis(conn, "resp@exemplo.com")


def test_email_com_maiusculas_e_rejeitado(conn: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
        _usuario(conn, "Ana@Exemplo.com", "admin")


def test_atribuicao_duplicada_e_rejeitada(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    _usuario(conn, "resp@exemplo.com", "responsavel")
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"])

    with pytest.raises(psycopg.errors.UniqueViolation), conn.transaction():
        _acesso(conn, "resp@exemplo.com", cenario["n4_a"])


def test_mesma_linha_em_n4_e_projeto_nao_duplica_resultado(
    conn: psycopg.Connection, cenario: dict[str, int]
) -> None:
    """N4 inteiro e projeto específico do mesmo N4 não podem gerar linha repetida na view."""
    _usuario(conn, "resp@exemplo.com", "responsavel")
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"])
    _acesso(conn, "resp@exemplo.com", cenario["n4_a"], cenario["p1"])

    rows = conn.execute(
        "select linha_id from vw_permissao_linha where email = %s", ("resp@exemplo.com",)
    ).fetchall()
    ids = [int(r[0]) for r in rows]
    assert sorted(ids) == sorted({cenario["linha_a1"], cenario["linha_a2"]})
