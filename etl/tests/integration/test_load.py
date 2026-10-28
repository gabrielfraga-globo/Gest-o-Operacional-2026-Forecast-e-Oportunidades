from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pandas as pd
import psycopg
import pytest

from opex_etl.ingest import ResultadoIngestao, ler_base
from opex_etl.load import JaCarregadoError, ReconciliacaoError, carregar
from opex_etl.normalize import aplicar_aliases, sugerir_aliases
from opex_etl.validate import aplicar_correcoes, relatorio_markdown, validar
from tests.fixtures.planilhas import LINHA_PADRAO, criar_planilha_base

pytestmark = pytest.mark.integration

TOLERANCIA = Decimal("1.00")
P1 = "P1 - PROJETO UM/NA/NA"
P2 = "P2 - PROJETO DOIS/NA/NA"
P3 = "P3 - SEM ORC/NA/NA"


def _linha(
    cen2: str,
    cenario: str,
    projeto: str,
    n4: str,
    mes: str,
    valor: float,
    fornecedor: str | None = "FORN A",
    n5: str | None = "N5 A",
) -> dict[str, object]:
    return {
        **LINHA_PADRAO,
        "CEN2": cen2,
        "Cenário": cenario,
        "Projeto": projeto,
        "N4": n4,
        "Mês": mes,
        "Valor": valor,
        "Fornecedor": fornecedor,
        "N5": n5,
    }


BASE: list[dict[str, object]] = [
    _linha("ORC+BG", "ORC_ORIGINAL", P1, "N4 A", "Janeiro", 1000.00),
    _linha("ORC+BG", "ORC_ORIGINAL", P2, "N4 B", "Janeiro", 500.00),
    _linha("REAL", "REALIZADO", P1, "N4 A", "Janeiro", 300.25),
    _linha("REAL", "REALIZADO", P2, "N4 B", "Fevereiro", 200.50),
    _linha("REAL", "REALIZADO", P3, "N4 B", "Março", 80.00),
]


def _controles(linhas: list[dict[str, object]]) -> dict[str, Decimal]:
    """Controles calculados direto das linhas sintéticas, sem passar pelo pipeline."""
    orc = Decimal("0")
    real = Decimal("0")
    orc_por_grupo: dict[tuple[object, object], Decimal] = defaultdict(Decimal)
    real_por_grupo: dict[tuple[object, object], Decimal] = defaultdict(Decimal)
    for linha in linhas:
        valor = Decimal(str(linha["Valor"]))
        grupo = (linha["N4"], linha["Projeto"])
        if linha["CEN2"] == "ORC+BG":
            orc += valor
            orc_por_grupo[grupo] += valor
        else:
            real += valor
            real_por_grupo[grupo] += valor
    sem_orcamento = sum(
        (
            real_por_grupo[g]
            for g in real_por_grupo
            if orc_por_grupo.get(g, Decimal("0")) == 0 and real_por_grupo[g] != 0
        ),
        Decimal("0"),
    )
    return {
        "orc_bg": orc,
        "realizado": real,
        "saldo": orc - real,
        "real_sem_orcamento": sem_orcamento,
    }


def _preparar(caminho: Path) -> tuple[ResultadoIngestao, pd.DataFrame, str]:
    ingestao = ler_base(caminho)
    df = aplicar_correcoes(ingestao.dados)
    relatorio = relatorio_markdown(validar(df), ingestao.linhas_lidas, ingestao.sha256)
    projetos = [p for p in df["projeto"] if isinstance(p, str)]
    df = aplicar_aliases(df, sugerir_aliases(projetos))
    return ingestao, df, relatorio


def _carregar(
    conn: psycopg.Connection[object],
    caminho: Path,
    controles: dict[str, Decimal],
) -> int:
    ingestao, df, relatorio = _preparar(caminho)
    return carregar(conn, ingestao, df, relatorio, TOLERANCIA, controles)


def _um(
    conn: psycopg.Connection[object], sql: str, params: tuple[object, ...] = ()
) -> tuple[object, ...]:
    linha = conn.execute(sql, params).fetchone()  # type: ignore[arg-type]
    assert linha is not None
    return linha


def test_carga_ok_grava_fatos_dimensoes_e_linhas(
    conn: psycopg.Connection[object], tmp_path: Path
) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", BASE)

    id_run = _carregar(conn, caminho, _controles(BASE))

    assert _um(conn, "select status, linhas_lidas from import_run where id = %s", (id_run,)) == (
        "ok",
        5,
    )
    assert _um(conn, "select count(*) from fato_lancamento") == (5,)
    assert _um(conn, "select sum(valor) from fato_lancamento") == (Decimal("2080.75"),)
    nomes_n4 = {linha[0] for linha in conn.execute("select nome from dim_n4").fetchall()}  # type: ignore[attr-defined]
    assert nomes_n4 == {"N4 A", "N4 B"}
    codigos = [
        linha[0]
        for linha in conn.execute(  # type: ignore[attr-defined]
            "select codigo from dim_projeto where codigo <> '__REAL_SEM_ORC__' order by codigo"
        ).fetchall()
    ]
    assert codigos == ["P1", "P2", "P3"]
    # (N4 A, P1), (N4 B, P2) e (N4 B, especial): o P3 sem orçamento é remapeado.
    assert _um(conn, "select count(*) from forecast_linha") == (3,)
    assert _um(conn, "select count(*) from forecast_linha where ativo") == (3,)


def test_mesmo_arquivo_duas_vezes_levanta_ja_carregado(
    conn: psycopg.Connection[object], tmp_path: Path
) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", BASE)
    _carregar(conn, caminho, _controles(BASE))

    with pytest.raises(JaCarregadoError):
        _carregar(conn, caminho, _controles(BASE))

    assert _um(conn, "select count(*) from import_run where status = 'ok'") == (1,)


def test_recarga_com_arquivo_novo_substitui_fatos_e_preserva_forecast_input(
    conn: psycopg.Connection[object], tmp_path: Path
) -> None:
    id_antigo = _carregar(conn, criar_planilha_base(tmp_path / "v1.xlsx", BASE), _controles(BASE))
    conn.execute(  # type: ignore[attr-defined]
        "insert into forecast_input (linha_id, previsao_futura) "
        "select linha_id, 123.45 from forecast_linha "
        "where n4_id = (select n4_id from dim_n4 where nome = 'N4 A')"
    )

    nova = [*BASE, _linha("REAL", "REALIZADO", P1, "N4 A", "Abril", 50.00)]
    id_novo = _carregar(conn, criar_planilha_base(tmp_path / "v2.xlsx", nova), _controles(nova))

    assert id_novo != id_antigo
    assert _um(conn, "select count(*) from fato_lancamento") == (6,)
    assert _um(
        conn, "select count(*) from fato_lancamento where import_run_id = %s", (id_antigo,)
    ) == (0,)
    assert _um(conn, "select previsao_futura, versao from forecast_input") == (
        Decimal("123.45"),
        1,
    )


def test_linha_que_some_fica_inativa(conn: psycopg.Connection[object], tmp_path: Path) -> None:
    _carregar(conn, criar_planilha_base(tmp_path / "v1.xlsx", BASE), _controles(BASE))

    sem_p2 = [BASE[0], BASE[2], BASE[4]]
    _carregar(conn, criar_planilha_base(tmp_path / "v2.xlsx", sem_p2), _controles(sem_p2))

    assert _um(
        conn,
        "select f.ativo from forecast_linha f join dim_projeto p on p.projeto_id = f.projeto_id "
        "where p.codigo = 'P2'",
    ) == (False,)
    assert _um(
        conn,
        "select f.ativo from forecast_linha f join dim_projeto p on p.projeto_id = f.projeto_id "
        "where p.codigo = 'P1'",
    ) == (True,)
    assert _um(conn, "select count(*) from forecast_linha") == (3,)


def test_reconciliacao_divergente_desfaz_carga_e_registra_failed(
    conn: psycopg.Connection[object], tmp_path: Path
) -> None:
    caminho = criar_planilha_base(tmp_path / "base.xlsx", BASE)
    controles = _controles(BASE)
    errados = {**controles, "orc_bg": controles["orc_bg"] + Decimal("1000")}

    with pytest.raises(ReconciliacaoError) as erro:
        _carregar(conn, caminho, errados)

    assert [r.nome for r in erro.value.resultados if not r.ok] == ["orc_bg"]
    assert _um(conn, "select count(*) from fato_lancamento") == (0,)
    assert _um(conn, "select count(*) from forecast_linha") == (0,)
    assert _um(conn, "select count(*) from import_run where status = 'ok'") == (0,)
    status, reconciliacao = _um(
        conn, "select status, reconciliacao from import_run where status = 'failed'"
    )
    assert status == "failed"
    assert isinstance(reconciliacao, list)
    orc = next(r for r in reconciliacao if r["nome"] == "orc_bg")
    assert orc["ok"] is False


def test_real_sem_orcamento_gera_linha_especial(
    conn: psycopg.Connection[object], tmp_path: Path
) -> None:
    _carregar(conn, criar_planilha_base(tmp_path / "base.xlsx", BASE), _controles(BASE))

    assert _um(
        conn,
        "select s.orc_bg, s.realizado from vw_saldo_reagrupado s "
        "join dim_projeto p on p.projeto_id = s.projeto_id "
        "where p.codigo = '__REAL_SEM_ORC__'",
    ) == (Decimal("0"), Decimal("80.00"))
    assert _um(
        conn, "select real_sem_orcamento, linhas_real_sem_orcamento from vw_reconciliacao"
    ) == (
        Decimal("80.00"),
        1,
    )


def test_texto_vazio_vira_null_no_banco(conn: psycopg.Connection[object], tmp_path: Path) -> None:
    com_vazio = [
        *BASE,
        _linha("REAL", "REALIZADO", P1, "N4 A", "Abril", 10.00, fornecedor=None, n5=None),
    ]
    caminho = criar_planilha_base(tmp_path / "base.xlsx", com_vazio)

    _carregar(conn, caminho, _controles(com_vazio))

    assert _um(
        conn, "select count(*) from fato_lancamento where fornecedor is null and n5 is null"
    ) == (1,)
    assert _um(
        conn,
        "select count(*) from fato_lancamento where fornecedor in ('nan', 'NaN', 'None') "
        "or n5 in ('nan', 'NaN', 'None')",
    ) == (0,)
