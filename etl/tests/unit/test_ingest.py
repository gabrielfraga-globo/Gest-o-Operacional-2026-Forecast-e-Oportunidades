from pathlib import Path

import pandas as pd
import pytest

from opex_etl.domain import COLUNAS_BASE
from opex_etl.ingest import ErroIngestao, ler_base, sha256_arquivo
from tests.fixtures.planilhas import LINHA_PADRAO, criar_planilha_base


def test_le_base_renomeia_e_tipa(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO])

    resultado = ler_base(caminho)
    dados = resultado.dados

    assert set(COLUNAS_BASE.values()) <= set(dados.columns)
    assert "Projeto" not in dados.columns
    assert resultado.linhas_lidas == 1
    assert dados.loc[0, "mes"] == 1
    assert pd.api.types.is_integer_dtype(dados["mes"])
    assert dados.loc[0, "cen2"] == "REAL"
    assert isinstance(dados.loc[0, "valor"], float)


def test_linha_planilha_comeca_em_3(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO, LINHA_PADRAO])

    dados = ler_base(caminho).dados

    assert list(dados["linha_planilha"]) == [3, 4]


def test_row_key_unica_inclusive_com_linhas_identicas(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO, LINHA_PADRAO])

    chaves = list(ler_base(caminho).dados["row_key"])

    assert len(chaves) == 2
    assert all(len(chave) == 40 for chave in chaves)
    assert chaves[0] != chaves[1]


def test_row_key_deterministica(tmp_path: Path) -> None:
    outra = {**LINHA_PADRAO, "Conta": "C2"}
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO, outra, LINHA_PADRAO])

    primeira = list(ler_base(caminho).dados["row_key"])
    segunda = list(ler_base(caminho).dados["row_key"])

    assert primeira == segunda


def test_valor_nulo_permanece_nan(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [{**LINHA_PADRAO, "Valor": None}])

    dados = ler_base(caminho).dados

    assert pd.isna(dados.loc[0, "valor"])


def test_linha_totalmente_vazia_e_ignorada(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO, {}, LINHA_PADRAO])

    resultado = ler_base(caminho)

    assert resultado.linhas_lidas == 2
    assert list(resultado.dados["linha_planilha"]) == [3, 5]


def test_aba_ausente_levanta_erro(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO], nome_aba="Outra")

    with pytest.raises(ErroIngestao, match="Aba 'Base' não encontrada"):
        ler_base(caminho)


def test_coluna_ausente_levanta_erro_listando_coluna(tmp_path: Path) -> None:
    colunas = [coluna for coluna in COLUNAS_BASE if coluna != "Projeto"]
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO], colunas=colunas)

    with pytest.raises(ErroIngestao, match="Projeto"):
        ler_base(caminho)


def test_mes_invalido_informa_linha(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [{**LINHA_PADRAO, "Mês": "Treze"}])

    with pytest.raises(ErroIngestao, match="Linha 3"):
        ler_base(caminho)


def test_mes_vazio_informa_linha(tmp_path: Path) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [{**LINHA_PADRAO, "Mês": "  "}])

    with pytest.raises(ErroIngestao, match="Linha 3: mês inválido None"):
        ler_base(caminho)


def test_cen2_invalido_informa_linha(tmp_path: Path) -> None:
    linha_invalida = {**LINHA_PADRAO, "CEN2": "ORCADO"}
    caminho = criar_planilha_base(tmp_path / "base.xlsx", [LINHA_PADRAO, linha_invalida])

    with pytest.raises(ErroIngestao, match="Linha 4"):
        ler_base(caminho)


def test_sha256_muda_quando_conteudo_muda(tmp_path: Path) -> None:
    arquivo_a = criar_planilha_base(tmp_path / "a.xlsx", [LINHA_PADRAO])
    arquivo_b = criar_planilha_base(tmp_path / "b.xlsx", [{**LINHA_PADRAO, "Valor": 200.0}])

    assert sha256_arquivo(arquivo_a) == sha256_arquivo(arquivo_a)
    assert sha256_arquivo(arquivo_a) != sha256_arquivo(arquivo_b)
