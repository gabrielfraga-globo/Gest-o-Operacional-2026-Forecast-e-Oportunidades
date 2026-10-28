from pathlib import Path

import psycopg
import pytest

from opex_etl.cli import main
from tests.fixtures.planilhas import LINHA_PADRAO, criar_planilha_base

pytestmark = pytest.mark.integration

P1 = "P1 - PROJETO UM/NA/NA"


def _linha(cen2: str, cenario: str, valor: float) -> dict[str, object]:
    return {
        **LINHA_PADRAO,
        "CEN2": cen2,
        "Cenário": cenario,
        "Projeto": P1,
        "N4": "N4 A",
        "Mês": "Janeiro",
        "Valor": valor,
    }


@pytest.fixture
def cenario(
    tmp_path: Path, db_url: str, monkeypatch: pytest.MonkeyPatch, conn: psycopg.Connection[object]
) -> Path:
    from opex_etl import cli

    monkeypatch.setattr(cli, "RAIZ_REPOSITORIO", tmp_path)
    monkeypatch.setattr(cli, "ARQUIVO_ENV", tmp_path / "nao-existe.env")
    monkeypatch.setenv("DATABASE_URL", db_url)

    criar_planilha_base(
        tmp_path / "base.xlsx",
        [_linha("ORC+BG", "ORC_ORIGINAL", 1000.00), _linha("REAL", "REALIZADO", 300.25)],
    )
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "controls.yaml").write_text(
        "tolerancia: 1.00\n"
        "controles:\n"
        "  orc_bg: 1000.00\n"
        "  realizado: 300.25\n"
        "  saldo: 699.75\n"
        "  real_sem_orcamento: 0.00\n",
        encoding="utf-8",
    )
    assert main(["gerar-aliases", "base.xlsx", "--saida", "config/project_aliases.csv"]) == 0
    return tmp_path


def test_carregar_retorna_zero_e_status_mostra_import(
    cenario: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["carregar", "base.xlsx", "--controles", "config/controls.yaml"]) == 0
    saida = capsys.readouterr().out
    assert "Carga concluída" in saida
    assert "ok" in saida

    assert main(["status"]) == 0
    saida_status = capsys.readouterr().out
    assert "base.xlsx" in saida_status
    assert "68.623.868,85" not in saida_status
    assert "1.000,00" in saida_status


def test_segunda_carga_do_mesmo_arquivo_retorna_zero_sem_recarregar(
    cenario: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["carregar", "base.xlsx", "--controles", "config/controls.yaml"]) == 0
    capsys.readouterr()

    assert main(["carregar", "base.xlsx", "--controles", "config/controls.yaml"]) == 0
    assert "Arquivo já carregado" in capsys.readouterr().out
