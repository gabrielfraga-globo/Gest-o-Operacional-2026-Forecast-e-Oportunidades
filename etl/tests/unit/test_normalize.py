from pathlib import Path

import pandas as pd
import pytest

from opex_etl.normalize import (
    AliasFaltanteError,
    aplicar_aliases,
    codigo_projeto,
    escrever_aliases,
    ler_aliases,
    sugerir_aliases,
    sugerir_nome_curto,
    tipo_orcamento,
)


def test_codigo_projeto_antes_do_primeiro_hifen() -> None:
    assert (
        codigo_projeto("C.EST.000001-01-2-999 - NOME - EXTRA/2026/OPEX/NA")
        == "C.EST.000001-01-2-999"
    )


def test_sugere_nome_remove_prefixo_e_sufixo() -> None:
    assert sugerir_nome_curto("I.EST.000072-999-999 - OUTSOURCING/NA/NA") == "Outsourcing"
    assert sugerir_nome_curto("X - NOME/") == "Nome"


def test_remove_ano_e_tipo_do_final() -> None:
    assert sugerir_nome_curto("C.EST.1 - CÂMERAS ROBÓTICAS/2023/CAPEX/NA") == "Câmeras Robóticas"
    assert sugerir_nome_curto("C.EST.1 - CÂMERAS ROBÓTICAS/2026/OPEX") == "Câmeras Robóticas"
    assert sugerir_nome_curto("C.EST.1 - CÂMERAS ROBÓTICAS/2026/OPEX/") == "Câmeras Robóticas"


def test_tipo_orcamento() -> None:
    assert tipo_orcamento("X - A/2023/CAPEX/NA") == "Capex"
    assert tipo_orcamento("X - A/2026/OPEX") == "Opex"
    assert tipo_orcamento("X - A/NA") is None


def test_indireto() -> None:
    assert sugerir_nome_curto("0000000000000000 - INDIRETO") == "Indireto"


def test_preposicoes_em_minusculas() -> None:
    assert sugerir_nome_curto("X - PLATAFORMA DE PRODUÇÃO/NA/NA") == "Plataforma de Produção"


def test_preposicao_na_primeira_palavra_fica_capitalizada() -> None:
    assert sugerir_nome_curto("X - DE PLATAFORMA/NA") == "De Plataforma"


def test_palavra_com_digito_fica_maiuscula() -> None:
    assert (
        sugerir_nome_curto("X - CAIXAS ACÚSTICAS DE PA MG-2/2025/OPEX/NA")
        == "Caixas Acústicas de PA MG-2"
    )


def test_sigla_com_pontuacao() -> None:
    assert sugerir_nome_curto("X - OBS. ÁUDIO - JB, SP E MG-2/2023/CAPEX/NA") == (
        "Obs. Áudio - JB, SP e MG-2"
    )


def test_corta_em_40_com_reticencias() -> None:
    nome = sugerir_nome_curto("X - AAAAAAAAAAAA BBBBBBBBBBBB CCCCCCCCCCCC DDDDDDDDDDDD/NA")

    assert nome == "Aaaaaaaaaaaa Bbbbbbbbbbbb Cccccccccccc…"
    assert len(nome) <= 40


def test_nome_vazio_usa_codigo_do_projeto() -> None:
    assert sugerir_nome_curto("X - /NA") == "X"


def test_mesmo_codigo_com_textos_diferentes_gera_um_alias() -> None:
    aliases = sugerir_aliases(["C.EST.1 - NOME/2026/OPEX", "C.EST.1 - NOME/2026/OPEX/NA"])

    assert aliases == {"C.EST.1": "Nome"}


def test_colisao_resolvida_por_tipo() -> None:
    aliases = sugerir_aliases(
        [
            "C.EST.000002-01-1-999 - NOME X/2024/CAPEX/NA",
            "C.EST.000002-01-2-999 - NOME X/2024/OPEX/NA",
        ]
    )

    assert aliases == {
        "C.EST.000002-01-1-999": "Nome X · Capex",
        "C.EST.000002-01-2-999": "Nome X · Opex",
    }


def test_colisao_por_tipo_com_nome_longo_cabe_em_40() -> None:
    nome = "A" * 12 + " " + "B" * 12 + " " + "C" * 12 + " " + "D" * 12
    aliases = sugerir_aliases(
        [f"C.EST.1-1-1 - {nome}/2024/CAPEX/NA", f"C.EST.1-1-2 - {nome}/2024/OPEX/NA"]
    )

    assert all(len(alias) <= 40 for alias in aliases.values())
    assert aliases["C.EST.1-1-1"].endswith(" · Capex")
    assert aliases["C.EST.1-1-2"].endswith(" · Opex")


def test_colisao_resolvida_por_sufixo_do_codigo() -> None:
    aliases = sugerir_aliases(["P.EVT.000022-006-013 - NOME/NA", "P.EVT.000022-006-999 - NOME/NA"])

    assert aliases == {
        "P.EVT.000022-006-013": "Nome · 006-013",
        "P.EVT.000022-006-999": "Nome · 006-999",
    }


def test_colisao_final_com_numeracao() -> None:
    aliases = sugerir_aliases(["A-1 - NOME/NA", "B-1 - NOME/NA", "C-1 - NOME/NA"])

    assert list(aliases.values()) == ["Nome · 1", "Nome · 1 #2", "Nome · 1 #3"]


def test_sugerir_aliases_sem_hifen_usa_numeracao() -> None:
    aliases = sugerir_aliases(
        [
            "I.EST.1 - OUTSOURCING/NA/NA",
            "I.EST.2 - OUTSOURCING/NA/NA",
            "I.EST.3 - OUTSOURCING/NA/NA",
        ]
    )

    assert list(aliases.values()) == ["Outsourcing", "Outsourcing #2", "Outsourcing #3"]
    assert list(aliases) == ["I.EST.1", "I.EST.2", "I.EST.3"]


def test_ler_e_escrever_aliases_ida_e_volta(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    aliases = {"B": "Bee", "A": "Ay, com vírgula"}

    escrever_aliases(caminho, aliases)

    assert caminho.read_text(encoding="utf-8").splitlines()[0] == "codigo,nome_curto"
    assert list(caminho.read_text(encoding="utf-8").splitlines())[1].startswith("A,")
    assert ler_aliases(caminho) == aliases


def test_ler_aliases_aceita_bom(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\nA,Um\n", encoding="utf-8-sig")

    assert ler_aliases(caminho) == {"A": "Um"}


def test_ler_aliases_rejeita_cabecalho_errado(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo;nome\nA;Um\n", encoding="utf-8")

    with pytest.raises(ValueError, match="cabeçalho"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_codigo_duplicado_com_linha(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\nA,Um\nA,Dois\n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 3: codigo duplicado 'A'"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_nome_duplicado(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\nA,Um\nB,Um\n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 3: nome_curto duplicado 'Um'"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_nome_maior_que_40(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text(f"codigo,nome_curto\nA,{'x' * 41}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 2: nome_curto com 41 caracteres"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_nome_vazio(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\nA,  \n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 2: nome_curto vazio"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_codigo_vazio(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\n ,Um\n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 2: codigo vazio"):
        ler_aliases(caminho)


def test_ler_aliases_rejeita_numero_de_colunas_errado(tmp_path: Path) -> None:
    caminho = tmp_path / "aliases.csv"
    caminho.write_text("codigo,nome_curto\nA,Um,extra\n", encoding="utf-8")

    with pytest.raises(ValueError, match="linha 2: esperadas 2 colunas, recebidas 3"):
        ler_aliases(caminho)


def test_aplicar_aliases_cria_coluna_e_nao_altera_original() -> None:
    df = pd.DataFrame({"projeto": ["A", "A"], "valor": [1.0, 2.0]})

    resultado = aplicar_aliases(df, {"A": "Alfa"})

    assert list(resultado["codigo_projeto"]) == ["A", "A"]
    assert list(resultado["projeto_curto"]) == ["Alfa", "Alfa"]
    assert "projeto_curto" not in df.columns


def test_aplicar_aliases_por_codigo() -> None:
    df = pd.DataFrame({"projeto": ["C.EST.1 - NOME/2026/OPEX", "C.EST.1 - NOME/2026/OPEX/NA"]})

    resultado = aplicar_aliases(df, {"C.EST.1": "Nome"})

    assert list(resultado["codigo_projeto"]) == ["C.EST.1", "C.EST.1"]
    assert list(resultado["projeto_curto"]) == ["Nome", "Nome"]


def test_aplicar_aliases_projeto_nulo_fica_nulo() -> None:
    df = pd.DataFrame({"projeto": ["A", None]})

    resultado = aplicar_aliases(df, {"A": "Alfa"})

    assert resultado["codigo_projeto"].iloc[0] == "A"
    assert pd.isna(resultado["codigo_projeto"].iloc[1])
    assert pd.isna(resultado["projeto_curto"].iloc[1])


def test_aplicar_aliases_faltante_lista_codigos() -> None:
    df = pd.DataFrame({"projeto": ["A", "C - X", "B", "A", None]})

    with pytest.raises(AliasFaltanteError) as erro:
        aplicar_aliases(df, {"A": "Alfa"})

    assert erro.value.faltantes == ["B", "C"]
    assert "B, C" in str(erro.value)
