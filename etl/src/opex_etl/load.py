"""Carga idempotente da base de lançamentos no Postgres, com reconciliação na mesma transação."""

from __future__ import annotations

from collections.abc import Mapping
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import pandas as pd
import psycopg

from opex_etl.ingest import ResultadoIngestao
from opex_etl.reconcile import ResultadoControle, reconciliar, resultados_json

_COLUNAS_FATO = (
    "row_key, import_run_id, cen2, cenario, n4_id, n5, centro_custo, projeto_id, "
    "projeto_texto, finalidade, fornecedor, conta, grupo, mes, valor, origem, lancamento, "
    "oc_rc, dt_contabilizacao, linha_planilha"
)


class JaCarregadoError(Exception):
    """A planilha (mesmo sha256) já foi carregada com sucesso."""


class ReconciliacaoError(Exception):
    def __init__(self, resultados: list[ResultadoControle]) -> None:
        divergentes = ", ".join(r.nome for r in resultados if not r.ok)
        super().__init__(f"Reconciliação divergente: {divergentes}")
        self.resultados = resultados


def carregar(
    conn: psycopg.Connection[Any],
    ingestao: ResultadoIngestao,
    df: pd.DataFrame,
    relatorio_dq: str,
    tolerancia: Decimal,
    controles: Mapping[str, Decimal],
) -> int:
    try:
        with conn.transaction():
            if _ja_carregado(conn, ingestao.sha256):
                raise JaCarregadoError(ingestao.sha256)
            return _gravar_carga(conn, ingestao, df, relatorio_dq, tolerancia, controles)
    except ReconciliacaoError as erro:
        with conn.transaction():
            conn.execute(
                "insert into import_run (arquivo, sha256, linhas_lidas, status, relatorio_dq, "
                "reconciliacao) values (%s, %s, %s, 'failed', %s, %s::jsonb)",
                (
                    ingestao.caminho.name,
                    ingestao.sha256,
                    ingestao.linhas_lidas,
                    relatorio_dq,
                    resultados_json(erro.resultados),
                ),
            )
        raise


def _ja_carregado(conn: psycopg.Connection[Any], sha256: str) -> bool:
    linha = conn.execute(
        "select 1 from import_run where sha256 = %s and status = 'ok'", (sha256,)
    ).fetchone()
    return linha is not None


def _gravar_carga(
    conn: psycopg.Connection[Any],
    ingestao: ResultadoIngestao,
    df: pd.DataFrame,
    relatorio_dq: str,
    tolerancia: Decimal,
    controles: Mapping[str, Decimal],
) -> int:
    linha = conn.execute(
        "insert into import_run (arquivo, sha256, linhas_lidas, status, relatorio_dq) "
        "values (%s, %s, %s, 'ok', %s) returning id",
        (ingestao.caminho.name, ingestao.sha256, ingestao.linhas_lidas, relatorio_dq),
    ).fetchone()
    if linha is None:
        raise RuntimeError("insert em import_run não retornou id")
    id_run = int(linha[0])

    nomes_n4 = sorted({nome for nome in (_nulo(v) for v in df["n4"]) if nome is not None})
    for nome in nomes_n4:
        conn.execute("insert into dim_n4 (nome) values (%s) on conflict (nome) do nothing", (nome,))

    pares = sorted(
        {
            (codigo, nome_curto)
            for codigo, nome_curto in (
                (_nulo(c), _nulo(p))
                for c, p in zip(df["codigo_projeto"], df["projeto_curto"], strict=True)
            )
            if codigo is not None and nome_curto is not None
        }
    )
    for codigo, nome_curto in pares:
        conn.execute(
            "insert into dim_projeto (codigo, nome_curto) values (%s, %s) "
            "on conflict (codigo) do update set nome_curto = excluded.nome_curto",
            (codigo, nome_curto),
        )

    mapa_n4 = {
        str(nome): int(n4_id)
        for nome, n4_id in conn.execute("select nome, n4_id from dim_n4").fetchall()
    }
    mapa_projeto = {
        str(codigo): int(projeto_id)
        for codigo, projeto_id in conn.execute(
            "select codigo, projeto_id from dim_projeto"
        ).fetchall()
    }

    conn.execute("delete from fato_lancamento")
    comando = f"copy fato_lancamento ({_COLUNAS_FATO}) from stdin"
    with conn.cursor() as cur, cur.copy(comando) as copia:
        for registro in df.to_dict("records"):
            copia.write_row(_linha_fato(registro, id_run, mapa_n4, mapa_projeto))

    conn.execute(
        "insert into forecast_linha (n4_id, projeto_id) "
        "select distinct n4_id, projeto_id from vw_saldo_reagrupado "
        "on conflict (n4_id, projeto_id) do nothing"
    )
    conn.execute(
        "update forecast_linha set ativo = exists ("
        "select 1 from vw_saldo_reagrupado s "
        "where s.n4_id = forecast_linha.n4_id and s.projeto_id = forecast_linha.projeto_id)"
    )

    resultados = reconciliar(conn, tolerancia, controles)
    if not all(r.ok for r in resultados):
        raise ReconciliacaoError(resultados)
    conn.execute(
        "update import_run set reconciliacao = %s::jsonb where id = %s",
        (resultados_json(resultados), id_run),
    )
    return id_run


def _linha_fato(
    registro: Mapping[Any, Any],
    id_run: int,
    mapa_n4: Mapping[str, int],
    mapa_projeto: Mapping[str, int],
) -> tuple[Any, ...]:
    linha_planilha = int(registro["linha_planilha"])
    n4 = _nulo(registro["n4"])
    if n4 is None:
        raise ValueError(f"linha {linha_planilha} da Base: N4 vazio")
    return (
        _nulo(registro["row_key"]),
        id_run,
        _nulo(registro["cen2"]),
        _nulo(registro["cenario"]),
        mapa_n4[n4],
        _nulo(registro["n5"]),
        _nulo(registro["centro_custo"]),
        mapa_projeto[str(registro["codigo_projeto"])],
        _nulo(registro["projeto"]),
        _nulo(registro["finalidade"]),
        _nulo(registro["fornecedor"]),
        _nulo(registro["conta"]),
        _nulo(registro["grupo"]),
        _inteiro(registro["mes"]),
        _valor(registro["valor"]),
        _nulo(registro["origem"]),
        _nulo(registro["lancamento"]),
        _nulo(registro["oc_rc"]),
        _nulo(registro["dt_contabilizacao"]),
        linha_planilha,
    )


def _nulo(valor: Any) -> Any:
    """Converte NaN, NaT e pd.NA (vindos do pandas 3) em None, para gravar NULL."""
    if valor is None:
        return None
    resultado = pd.isna(valor)
    if isinstance(resultado, bool) and resultado:
        return None
    return valor


def _inteiro(valor: Any) -> int | None:
    valor = _nulo(valor)
    return None if valor is None else int(valor)


def _valor(valor: Any) -> Decimal | None:
    valor = _nulo(valor)
    if valor is None:
        return None
    return Decimal(str(float(valor))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
