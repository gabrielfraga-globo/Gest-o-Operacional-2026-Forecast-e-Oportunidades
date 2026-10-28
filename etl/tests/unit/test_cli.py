from decimal import Decimal
from pathlib import Path

import pytest

from opex_etl import cli
from opex_etl.cli import formatar_valor, main
from tests.fixtures.planilhas import LINHA_PADRAO, criar_planilha_base

P1 = "P1 - PROJETO UM/NA/NA"
P2 = "P2 - PROJETO DOIS/NA/NA"


def _linha(
    cen2: str, cenario: str, projeto: str, valor: float, **extra: object
) -> dict[str, object]:
    return {
        **LINHA_PADRAO,
        "CEN2": cen2,
        "Cenário": cenario,
        "Projeto": projeto,
        "Valor": valor,
        **extra,
    }


@pytest.fixture
def raiz(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(cli, "RAIZ_REPOSITORIO", tmp_path)
    monkeypatch.setattr(cli, "ARQUIVO_ENV", tmp_path / "etl" / ".env")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return tmp_path


def _planilha(raiz: Path, linhas: list[dict[str, object]]) -> Path:
    return criar_planilha_base(raiz / "base.xlsx", linhas)


def test_gerar_aliases_cria_csv_e_preserva_nomes_editados(
    raiz: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    planilha = _planilha(
        raiz, [_linha("REAL", "REALIZADO", P1, 10.0), _linha("REAL", "REALIZADO", P2, 5.0)]
    )
    saida = raiz / "config" / "project_aliases.csv"

    assert main(["gerar-aliases", str(planilha), "--saida", str(saida)]) == 0
    assert saida.exists()
    assert "0 mantidos, 2 novos" in capsys.readouterr().out

    conteudo = saida.read_text(encoding="utf-8")
    nome_sugerido = next(
        linha.split(",")[1] for linha in conteudo.splitlines() if linha.startswith("P1")
    )
    saida.write_text(conteudo.replace(nome_sugerido, "Primeiro", 1), encoding="utf-8")

    assert main(["gerar-aliases", str(planilha), "--saida", str(saida)]) == 0
    assert "Primeiro" in saida.read_text(encoding="utf-8")
    assert "2 mantidos, 0 novos" in capsys.readouterr().out


def test_validar_retorna_zero_sem_erro(raiz: Path, capsys: pytest.CaptureFixture[str]) -> None:
    planilha = _planilha(raiz, [_linha("REAL", "REALIZADO", P1, 10.0)])
    aliases = raiz / "config" / "project_aliases.csv"
    main(["gerar-aliases", str(planilha), "--saida", str(aliases)])

    assert main(["validar", str(planilha), "--aliases", str(aliases)]) == 0
    assert (raiz / "out" / "dq_report.md").exists()
    assert "Validação aprovada" in capsys.readouterr().out


def test_validar_retorna_um_com_erro(raiz: Path, capsys: pytest.CaptureFixture[str]) -> None:
    planilha = _planilha(raiz, [_linha("ORC+BG", "REALIZADO", P1, 10.0)])
    aliases = raiz / "config" / "project_aliases.csv"
    main(["gerar-aliases", str(planilha), "--saida", str(aliases)])

    assert main(["validar", str(planilha), "--aliases", str(aliases)]) == 1
    assert "Validação reprovada" in capsys.readouterr().out


def test_validar_retorna_um_com_alias_faltante(
    raiz: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    planilha = _planilha(raiz, [_linha("REAL", "REALIZADO", P1, 10.0)])
    aliases = raiz / "config" / "project_aliases.csv"
    aliases.parent.mkdir(parents=True)
    aliases.write_text("codigo,nome_curto\n", encoding="utf-8")

    assert main(["validar", str(planilha), "--aliases", str(aliases)]) == 1
    assert "P1" in capsys.readouterr().out


def test_carregar_sem_database_url_retorna_um(
    raiz: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    planilha = _planilha(raiz, [_linha("REAL", "REALIZADO", P1, 10.0)])

    assert main(["carregar", str(planilha)]) == 1
    assert "DATABASE_URL" in capsys.readouterr().err


def test_status_sem_database_url_retorna_um(raiz: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["status"]) == 1
    assert "DATABASE_URL" in capsys.readouterr().err


def test_caminho_relativo_resolve_a_partir_da_raiz(raiz: Path) -> None:
    _planilha(raiz, [_linha("REAL", "REALIZADO", P1, 10.0)])
    assert main(["gerar-aliases", "base.xlsx", "--saida", "config/aliases.csv"]) == 0
    assert (raiz / "config" / "aliases.csv").exists()


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        (Decimal("68623868.85"), "68.623.868,85"),
        (Decimal("-1234.5"), "-1.234,50"),
        (Decimal("999.999"), "1.000,00"),
        (Decimal("0"), "0,00"),
    ],
)
def test_formatar_valor_padrao_brasileiro(valor: Decimal, esperado: str) -> None:
    assert formatar_valor(valor) == esperado
