from pathlib import Path

import pandas as pd
import pytest

from opex_etl.domain import Severidade
from opex_etl.ingest import ler_base
from opex_etl.validate import (
    Problema,
    aplicar_correcoes,
    relatorio_markdown,
    tem_erro,
    validar,
)
from tests.fixtures.planilhas import LINHA_PADRAO, criar_planilha_base


def _ler(tmp_path: Path, linhas: list[dict[str, object]]) -> pd.DataFrame:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", linhas)
    return ler_base(caminho).dados


def _regras(problemas: list[Problema]) -> list[str]:
    return [p.regra for p in problemas]


def test_base_limpa_sem_problemas(tmp_path: Path) -> None:
    df = _ler(tmp_path, [LINHA_PADRAO])

    assert validar(df) == []


def test_valor_nulo_gera_warn_e_correcao_zera(tmp_path: Path) -> None:
    df = _ler(tmp_path, [{**LINHA_PADRAO, "Valor": None}])

    problemas = validar(df)

    assert len(problemas) == 1
    assert problemas[0].severidade is Severidade.WARN
    assert problemas[0].regra == "VALOR_NULO"
    assert problemas[0].mensagem == "1 lançamento(s) sem valor; tratados como 0"
    assert problemas[0].linhas == (3,)
    corrigido = aplicar_correcoes(df)
    assert corrigido.loc[0, "valor"] == pytest.approx(0.0)
    assert validar(corrigido) == []


def test_origem_nula_gera_warn_com_soma(tmp_path: Path) -> None:
    df = _ler(
        tmp_path,
        [
            {**LINHA_PADRAO, "Nome da Origem": None, "Valor": 100.0},
            {**LINHA_PADRAO, "Nome da Origem": None, "Valor": None},
            {**LINHA_PADRAO, "Nome da Origem": "GL", "Valor": 50.0},
        ],
    )

    problemas = [p for p in validar(df) if p.regra == "ORIGEM_NULA"]

    assert len(problemas) == 1
    assert problemas[0].severidade is Severidade.WARN
    assert problemas[0].mensagem == "2 linha(s) sem origem; soma dos valores: 100.00"
    assert problemas[0].linhas == (3, 4)


def test_obrigatorio_nulo_gera_error_por_coluna(tmp_path: Path) -> None:
    df = _ler(tmp_path, [{**LINHA_PADRAO, "Conta": None, "N4": None}])

    problemas = validar(df)

    assert _regras(problemas) == ["OBRIGATORIO_NULO", "OBRIGATORIO_NULO"]
    assert all(p.severidade is Severidade.ERROR for p in problemas)
    assert [p.mensagem for p in problemas] == ["1 linha(s) sem conta", "1 linha(s) sem n4"]
    assert tem_erro(problemas)


def test_cenario_incoerente_gera_error(tmp_path: Path) -> None:
    df = _ler(
        tmp_path,
        [
            {**LINHA_PADRAO, "Cenário": "ORÇADO", "CEN2": "REAL"},
            {**LINHA_PADRAO, "Cenário": "REALIZADO", "CEN2": "ORC+BG"},
            {**LINHA_PADRAO, "Cenário": "ORÇADO", "CEN2": "ORC+BG"},
        ],
    )

    problemas = validar(df)

    assert len(problemas) == 1
    assert problemas[0].severidade is Severidade.ERROR
    assert problemas[0].regra == "CENARIO_INCOERENTE"
    assert problemas[0].mensagem == "2 linha(s) com cenário incoerente com CEN2"
    assert problemas[0].linhas == (3, 4)


def test_row_key_duplicada_gera_error(tmp_path: Path) -> None:
    df = _ler(tmp_path, [LINHA_PADRAO])
    duplicado = pd.concat([df, df], ignore_index=True)

    problemas = validar(duplicado)

    assert len(problemas) == 1
    assert problemas[0].severidade is Severidade.ERROR
    assert problemas[0].regra == "ROW_KEY_DUPLICADA"
    assert problemas[0].mensagem == "1 chave(s) duplicada(s)"
    assert problemas[0].linhas == (3,)


def test_linhas_limitadas_a_20_e_mensagem_com_total(tmp_path: Path) -> None:
    df = _ler(tmp_path, [{**LINHA_PADRAO, "Valor": None} for _ in range(25)])

    problemas = validar(df)

    assert len(problemas) == 1
    assert len(problemas[0].linhas) == 20
    assert problemas[0].linhas[0] == 3
    assert problemas[0].mensagem == "25 lançamento(s) sem valor; tratados como 0"


def test_aplicar_correcoes_nao_altera_original_e_arredonda(tmp_path: Path) -> None:
    df = _ler(
        tmp_path,
        [{**LINHA_PADRAO, "Valor": 10.126}, {**LINHA_PADRAO, "Valor": None}],
    )

    corrigido = aplicar_correcoes(df)

    assert df.loc[0, "valor"] == pytest.approx(10.126)
    assert pd.isna(df.loc[1, "valor"])
    assert corrigido.loc[0, "valor"] == pytest.approx(10.13)
    assert corrigido.loc[1, "valor"] == pytest.approx(0.0)


def test_relatorio_markdown_contem_tabela_e_sha() -> None:
    problemas = [Problema(Severidade.ERROR, "OBRIGATORIO_NULO", "1 linha(s) sem conta", (3, 7))]

    texto = relatorio_markdown(problemas, linhas_lidas=10, sha256="abc123")

    assert texto.startswith("# Relatório de qualidade")
    assert "- Linhas lidas: 10" in texto
    assert "- SHA-256: abc123" in texto
    assert "| Severidade | Regra | Mensagem | Linhas (amostra) |" in texto
    assert "| ERROR | OBRIGATORIO_NULO | 1 linha(s) sem conta | 3, 7 |" in texto
    assert "Nenhum problema encontrado." not in texto


def test_relatorio_sem_problemas() -> None:
    texto = relatorio_markdown([], linhas_lidas=0, sha256="abc123")

    assert "Nenhum problema encontrado." in texto
    assert "| Severidade" not in texto
