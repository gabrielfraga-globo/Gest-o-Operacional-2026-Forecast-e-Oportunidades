import pytest

from opex_etl.domain import (
    CAMPOS_ROW_KEY,
    COLUNAS_BASE,
    COLUNAS_OBRIGATORIAS,
    Cen2,
    cen2_da_planilha,
    mes_para_int,
)


def test_cen2_converte_orc_bg_e_real() -> None:
    assert cen2_da_planilha("ORC+BG") is Cen2.ORC_BG
    assert cen2_da_planilha("  REAL ") is Cen2.REAL


def test_cen2_invalido_levanta_erro() -> None:
    with pytest.raises(ValueError, match="CEN2 inválido"):
        cen2_da_planilha("ORCADO")


@pytest.mark.parametrize(
    ("nome", "esperado"),
    [
        ("Janeiro", 1),
        ("Fevereiro", 2),
        ("Março", 3),
        ("Abril", 4),
        ("Maio", 5),
        ("Junho", 6),
        ("Julho", 7),
        ("Agosto", 8),
        ("Setembro", 9),
        ("Outubro", 10),
        ("Novembro", 11),
        ("Dezembro", 12),
    ],
)
def test_mes_para_int_todos_os_meses(nome: str, esperado: int) -> None:
    assert mes_para_int(nome) == esperado


def test_mes_para_int_aceita_minusculas_espacos_e_marco_sem_acento() -> None:
    assert mes_para_int("  janeiro  ") == 1
    assert mes_para_int("MARÇO") == 3
    assert mes_para_int("marco") == 3


def test_mes_invalido_levanta_erro() -> None:
    with pytest.raises(ValueError, match="Mês inválido"):
        mes_para_int("Treze")


def test_colunas_obrigatorias_e_row_key_existem_no_mapeamento() -> None:
    internas = set(COLUNAS_BASE.values())
    for coluna in COLUNAS_OBRIGATORIAS:
        assert coluna in internas
    for campo in CAMPOS_ROW_KEY:
        assert campo in internas
