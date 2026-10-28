"""Carga da lista de acesso no banco (usuario, usuario_acesso e "user" do Better Auth)."""

from pathlib import Path

import psycopg
import pytest

from opex_etl.usuarios import ErroUsuariosError, carregar_usuarios

pytestmark = pytest.mark.integration

CABECALHO = "email,nome,papel,n4,projeto_codigo\n"


@pytest.fixture
def base(conn: psycopg.Connection) -> None:
    """Dois N4 e um projeto em cada: N4 Vendas (PRJ-1, PRJ-2) e N4 Compras (PRJ-3)."""
    conn.execute("insert into dim_n4 (nome) values ('N4 Vendas'), ('N4 Compras')")
    for codigo in ("PRJ-1", "PRJ-2", "PRJ-3"):
        conn.execute(
            "insert into dim_projeto (codigo, nome_curto) values (%s, %s)",
            (codigo, f"Projeto {codigo}"),
        )
    conn.execute(
        "insert into forecast_linha (n4_id, projeto_id, responsavel) "
        "select n.n4_id, p.projeto_id, 'Teste' from dim_n4 n, dim_projeto p "
        "where (n.nome = 'N4 Vendas' and p.codigo in ('PRJ-1', 'PRJ-2')) "
        "or (n.nome = 'N4 Compras' and p.codigo = 'PRJ-3')"
    )


def _csv(tmp_path: Path, conteudo: str) -> Path:
    caminho = tmp_path / "usuarios.csv"
    caminho.write_text(CABECALHO + conteudo, encoding="utf-8")
    return caminho


def _acessos(conn: psycopg.Connection, email: str) -> set[tuple[str, int | None]]:
    rows = conn.execute(
        "select n.nome, p.codigo from usuario_acesso a "
        "join dim_n4 n on n.n4_id = a.n4_id left join dim_projeto p on p.projeto_id = a.projeto_id "
        "where a.email = %s",
        (email,),
    ).fetchall()
    return {(nome, codigo) for nome, codigo in rows}


def test_carrega_usuarios_acessos_e_linhas_do_better_auth(
    conn: psycopg.Connection, base: None, tmp_path: Path
) -> None:
    caminho = _csv(
        tmp_path,
        "ana@exemplo.com,Ana,admin,,\n"
        "bruno@exemplo.com,Bruno,responsavel,N4 Vendas,\n"
        "carla@exemplo.com,Carla,responsavel,N4 Compras,PRJ-3\n",
    )

    resultado = carregar_usuarios(conn, caminho)

    assert (resultado.usuarios, resultado.acessos) == (3, 2)
    assert conn.execute(
        "select papel, ativo from usuario where email = 'ana@exemplo.com'"
    ).fetchone() == (
        "admin",
        True,
    )
    assert _acessos(conn, "bruno@exemplo.com") == {("N4 Vendas", None)}
    assert _acessos(conn, "carla@exemplo.com") == {("N4 Compras", "PRJ-3")}
    user = conn.execute(
        'select name, "emailVerified", id from "user" where email = \'bruno@exemplo.com\''
    ).fetchone()
    assert user is not None
    assert user[0] == "Bruno"
    assert user[1] is False
    assert user[2]


def test_reexecucao_substitui_acessos_do_arquivo_e_preserva_os_demais(
    conn: psycopg.Connection, base: None, tmp_path: Path
) -> None:
    carregar_usuarios(
        conn,
        _csv(
            tmp_path,
            "bruno@exemplo.com,Bruno,responsavel,N4 Vendas,\n"
            "fora@exemplo.com,Fora,responsavel,N4 Compras,\n",
        ),
    )
    conn.execute("update usuario set ativo = false where email = 'fora@exemplo.com'")

    resultado = carregar_usuarios(
        conn,
        _csv(tmp_path, "bruno@exemplo.com,Bruno Silva,responsavel,N4 Vendas,PRJ-1\n"),
    )

    assert (resultado.usuarios, resultado.acessos) == (1, 1)
    assert _acessos(conn, "bruno@exemplo.com") == {("N4 Vendas", "PRJ-1")}
    assert conn.execute(
        "select nome from usuario where email = 'bruno@exemplo.com'"
    ).fetchone() == ("Bruno Silva",)
    assert conn.execute(
        "select ativo from usuario where email = 'fora@exemplo.com'"
    ).fetchone() == (False,)
    assert _acessos(conn, "fora@exemplo.com") == {("N4 Compras", None)}
    nome_auth = conn.execute(
        "select name from \"user\" where email = 'bruno@exemplo.com'"
    ).fetchone()
    assert nome_auth == ("Bruno Silva",)
    assert conn.execute(
        "select count(*) from \"user\" where email = 'bruno@exemplo.com'"
    ).fetchone() == (1,)


def test_n4_inexistente_nao_grava_nada(
    conn: psycopg.Connection, base: None, tmp_path: Path
) -> None:
    caminho = _csv(
        tmp_path,
        "ana@exemplo.com,Ana,admin,,\nbruno@exemplo.com,Bruno,responsavel,N4 Inexistente,\n",
    )

    with pytest.raises(ErroUsuariosError) as info:
        carregar_usuarios(conn, caminho)

    assert info.value.problemas == ["linha 3: N4 'N4 Inexistente' não existe em dim_n4"]
    assert conn.execute("select count(*) from usuario").fetchone() == (0,)
    assert conn.execute('select count(*) from "user"').fetchone() == (0,)


def test_projeto_inexistente_ou_de_outro_n4_e_rejeitado(
    conn: psycopg.Connection, base: None, tmp_path: Path
) -> None:
    caminho = _csv(
        tmp_path,
        "bruno@exemplo.com,Bruno,responsavel,N4 Vendas,PRJ-9\n"
        "carla@exemplo.com,Carla,responsavel,N4 Vendas,PRJ-3\n",
    )

    with pytest.raises(ErroUsuariosError) as info:
        carregar_usuarios(conn, caminho)

    assert info.value.problemas == [
        "linha 2: projeto 'PRJ-9' não existe em dim_projeto",
        "linha 3: projeto 'PRJ-3' não pertence ao N4 'N4 Vendas' (não há linha em forecast_linha)",
    ]
    assert conn.execute("select count(*) from usuario_acesso").fetchone() == (0,)


def test_erro_de_validacao_do_csv_nao_toca_o_banco(
    conn: psycopg.Connection, base: None, tmp_path: Path
) -> None:
    caminho = _csv(tmp_path, "bruno@exemplo.com,Bruno,responsavel,,\n")

    with pytest.raises(ErroUsuariosError, match="responsável exige n4"):
        carregar_usuarios(conn, caminho)

    assert conn.execute("select count(*) from usuario").fetchone() == (0,)
