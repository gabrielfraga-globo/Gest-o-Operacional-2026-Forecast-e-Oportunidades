"""Validação da lista de acesso (CSV de usuários)."""

from pathlib import Path

import pytest

from opex_etl.usuarios import ErroUsuariosError, ler_usuarios, validar_usuarios

CABECALHO = "email,nome,papel,n4,projeto_codigo\n"


def _erros(texto: str) -> list[str]:
    with pytest.raises(ErroUsuariosError) as info:
        validar_usuarios(texto)
    return info.value.problemas


def test_aceita_admin_e_responsavel_com_n4_e_projeto() -> None:
    texto = (
        CABECALHO
        + "admin@exemplo.com,Ana,admin,,\n"
        + "resp@exemplo.com,Bruno,responsavel,N4 Vendas,\n"
        + "resp@exemplo.com,Bruno,responsavel,N4 Vendas,PRJ-1\n"
    )
    linhas = validar_usuarios(texto)
    assert [linha.numero for linha in linhas] == [2, 3, 4]
    assert linhas[2].projeto_codigo == "PRJ-1"


def test_normaliza_email_para_minusculas() -> None:
    linhas = validar_usuarios(CABECALHO + "Ana@Exemplo.COM,Ana,admin,,\n")
    assert linhas[0].email == "ana@exemplo.com"


def test_aceita_bom_utf8_no_arquivo(tmp_path: Path) -> None:
    caminho = tmp_path / "usuarios.csv"
    caminho.write_bytes(("\ufeff" + CABECALHO + "ana@exemplo.com,Ana,admin,,\n").encode("utf-8"))
    linhas = ler_usuarios(caminho)
    assert linhas[0].email == "ana@exemplo.com"


def test_rejeita_arquivo_que_nao_e_utf8(tmp_path: Path) -> None:
    caminho = tmp_path / "usuarios.csv"
    caminho.write_bytes(
        CABECALHO.encode("utf-8") + "ana@exemplo.com,Ana Úrsula,admin,,\n".encode("latin-1")
    )
    with pytest.raises(ErroUsuariosError, match="UTF-8"):
        ler_usuarios(caminho)


def test_rejeita_cabecalho_sem_colunas() -> None:
    erros = _erros("email,nome,papel,n4\nana@exemplo.com,Ana,admin,\n")
    assert erros == ["cabeçalho sem as colunas: projeto_codigo"]


def test_rejeita_arquivo_vazio() -> None:
    assert _erros("") == ["arquivo vazio"]


def test_rejeita_arquivo_sem_usuarios() -> None:
    assert _erros(CABECALHO + "\n\n") == ["nenhum usuário encontrado no arquivo"]


def test_rejeita_papel_invalido_com_numero_da_linha() -> None:
    erros = _erros(CABECALHO + "ana@exemplo.com,Ana,gerente,,\n")
    assert erros == ["linha 2: papel 'gerente' inválido (use admin ou responsavel)"]


def test_responsavel_exige_n4() -> None:
    erros = _erros(CABECALHO + "resp@exemplo.com,Bruno,responsavel,,\n")
    assert erros == ["linha 2: responsável exige n4"]


def test_admin_nao_recebe_n4_nem_projeto() -> None:
    erros = _erros(CABECALHO + "ana@exemplo.com,Ana,admin,N4 Vendas,\n")
    assert len(erros) == 1
    assert erros[0].startswith("linha 2: admin não recebe N4 nem projeto")


def test_rejeita_email_invalido_e_nome_vazio() -> None:
    erros = _erros(CABECALHO + "sem-arroba,Ana,admin,,\n,,admin,,\n")
    assert "linha 2: e-mail inválido 'sem-arroba'" in erros
    assert "linha 3: e-mail vazio" in erros
    assert "linha 3: nome vazio" in erros


def test_rejeita_numero_de_colunas_errado() -> None:
    erros = _erros(CABECALHO + "ana@exemplo.com,Ana,admin\n")
    assert erros == ["linha 2: esperadas 5 colunas, encontradas 3"]


def test_rejeita_acesso_duplicado_apontando_a_linha_original() -> None:
    texto = (
        CABECALHO
        + "resp@exemplo.com,Bruno,responsavel,N4 Vendas,PRJ-1\n"
        + "resp@exemplo.com,Bruno,responsavel,N4 Vendas,PRJ-1\n"
    )
    assert _erros(texto) == ["linha 3: acesso duplicado (igual à linha 2)"]


def test_rejeita_mesmo_email_com_nome_ou_papel_diferente() -> None:
    texto = (
        CABECALHO
        + "resp@exemplo.com,Bruno,responsavel,N4 Vendas,\n"
        + "resp@exemplo.com,Bruno Silva,responsavel,N4 Vendas,PRJ-1\n"
    )
    assert _erros(texto) == [
        "linha 3: e-mail resp@exemplo.com tem nome ou papel diferente da linha 2"
    ]


def test_junta_todos_os_erros_em_uma_mensagem() -> None:
    texto = CABECALHO + "a@x.com,A,gerente,,\nb@x.com,B,responsavel,,\n"
    erros = _erros(texto)
    assert len(erros) == 2
    assert erros[0].startswith("linha 2:")
    assert erros[1].startswith("linha 3:")
