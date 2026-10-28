"""Linha de comando: opex-etl gerar-aliases | validar | carregar | usuarios | status."""

import argparse
import os
import sys
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import psycopg
from dotenv import dotenv_values

from opex_etl.ingest import ErroIngestao, ResultadoIngestao, ler_base
from opex_etl.load import JaCarregadoError, ReconciliacaoError, carregar
from opex_etl.normalize import (
    AliasFaltanteError,
    aplicar_aliases,
    escrever_aliases,
    ler_aliases,
    sugerir_aliases,
)
from opex_etl.reconcile import ResultadoControle, ler_controles, reconciliar
from opex_etl.usuarios import carregar_usuarios
from opex_etl.validate import (
    Problema,
    aplicar_correcoes,
    relatorio_markdown,
    tem_erro,
    validar,
)

RAIZ_REPOSITORIO = Path(__file__).resolve().parents[3]
ARQUIVO_ENV = RAIZ_REPOSITORIO / "etl" / ".env"
ALIASES_PADRAO = Path("config") / "project_aliases.csv"
CONTROLES_PADRAO = Path("config") / "controls.yaml"
RELATORIO_PADRAO = Path("out") / "dq_report.md"
_CASAS = Decimal("0.01")


def formatar_valor(valor: Decimal) -> str:
    arredondado = valor.quantize(_CASAS, rounding=ROUND_HALF_UP)
    inteiro, centavos = f"{abs(arredondado):.2f}".split(".")
    sinal = "-" if arredondado < 0 else ""
    return f"{sinal}{int(inteiro):,}".replace(",", ".") + "," + centavos


def _resolver(caminho: Path) -> Path:
    return caminho if caminho.is_absolute() else RAIZ_REPOSITORIO / caminho


def _exigir_arquivo(caminho: Path, descricao: str) -> Path:
    if not caminho.is_file():
        raise FileNotFoundError(f"{descricao} não encontrado: {caminho}")
    return caminho


def _url_banco() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url and ARQUIVO_ENV.exists():
        url = dotenv_values(ARQUIVO_ENV).get("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL não definido (defina no ambiente ou em etl/.env)")
    return url


def _tabela(cabecalho: list[str], linhas: list[list[str]]) -> str:
    larguras = [max(map(len, coluna)) for coluna in zip(cabecalho, *linhas, strict=True)]

    def formatar(linha: list[str]) -> str:
        celulas = zip(linha, larguras, strict=True)
        return " | ".join(texto.ljust(largura) for texto, largura in celulas).rstrip()

    separador = "-+-".join("-" * largura for largura in larguras)
    return "\n".join([formatar(cabecalho), separador, *(formatar(linha) for linha in linhas)])


def _tabela_reconciliacao(resultados: list[ResultadoControle]) -> str:
    linhas = [
        [
            r.nome,
            formatar_valor(r.esperado),
            formatar_valor(r.obtido),
            formatar_valor(r.diferenca),
            "ok" if r.ok else "DIVERGENTE",
        ]
        for r in resultados
    ]
    return _tabela(["controle", "esperado", "obtido", "diferença", "situação"], linhas)


def _resumo(problemas: list[Problema]) -> str:
    if not problemas:
        return "Validação: nenhum problema encontrado."
    contagem = Counter(p.severidade.value for p in problemas)
    return "Validação: " + ", ".join(f"{sev}={n}" for sev, n in sorted(contagem.items()))


def _gravar_relatorio(problemas: list[Problema], ingestao: ResultadoIngestao) -> str:
    texto = relatorio_markdown(problemas, ingestao.linhas_lidas, ingestao.sha256)
    destino = RAIZ_REPOSITORIO / RELATORIO_PADRAO
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")
    return texto


def _gerar_aliases(planilha: Path, saida: Path) -> int:
    ingestao = ler_base(_exigir_arquivo(planilha, "Planilha"))
    projetos = [p for p in ingestao.dados["projeto"] if isinstance(p, str)]
    sugeridos = sugerir_aliases(projetos)

    existentes = ler_aliases(saida) if saida.exists() else {}
    nomes_em_uso = set(existentes.values())
    novos: dict[str, str] = {}
    for codigo, nome in sugeridos.items():
        if codigo in existentes:
            continue
        if nome in nomes_em_uso:
            raise ValueError(
                f"nome_curto {nome!r} sugerido para {codigo} já existe em {saida.name}; "
                "ajuste o arquivo à mão e rode de novo"
            )
        novos[codigo] = nome

    saida.parent.mkdir(parents=True, exist_ok=True)
    escrever_aliases(saida, {**existentes, **novos})
    print(f"{len(existentes)} mantidos, {len(novos)} novos")
    return 0


def _validar(planilha: Path, aliases: Path) -> int:
    ingestao = ler_base(_exigir_arquivo(planilha, "Planilha"))
    problemas = validar(ingestao.dados)
    _gravar_relatorio(problemas, ingestao)
    print(_resumo(problemas))
    print(f"Relatório: {RELATORIO_PADRAO.as_posix()}")

    reprovado = tem_erro(problemas)
    try:
        aplicar_aliases(ingestao.dados, ler_aliases(_exigir_arquivo(aliases, "Arquivo de aliases")))
    except AliasFaltanteError as erro:
        print(f"Alias faltante: {', '.join(erro.faltantes)} (rode gerar-aliases)")
        reprovado = True

    print("Validação reprovada." if reprovado else "Validação aprovada.")
    return 1 if reprovado else 0


def _carregar(planilha: Path, aliases: Path, controles: Path) -> int:
    url = _url_banco()
    ingestao = ler_base(_exigir_arquivo(planilha, "Planilha"))
    problemas = validar(ingestao.dados)
    relatorio = _gravar_relatorio(problemas, ingestao)
    print(_resumo(problemas))
    if tem_erro(problemas):
        print("Carga cancelada: há ERROR de validação. Veja " + RELATORIO_PADRAO.as_posix())
        return 1

    tolerancia, esperados = ler_controles(_exigir_arquivo(controles, "Arquivo de controles"))
    alias_por_codigo = ler_aliases(_exigir_arquivo(aliases, "Arquivo de aliases"))
    df = aplicar_aliases(aplicar_correcoes(ingestao.dados), alias_por_codigo)

    try:
        with psycopg.connect(url) as conn:
            try:
                id_run = carregar(conn, ingestao, df, relatorio, tolerancia, esperados)
            except JaCarregadoError:
                print(f"Arquivo já carregado (sha256 {ingestao.sha256[:12]})")
                return 0
            resultados = reconciliar(conn, tolerancia, esperados)
    except ReconciliacaoError as erro:
        print("Reconciliação divergente: carga desfeita e registrada como 'failed'.")
        print(_tabela_reconciliacao(erro.resultados))
        return 2

    print(f"Carga concluída: import_run {id_run}")
    print(_tabela_reconciliacao(resultados))
    return 0


def _usuarios(arquivo: Path) -> int:
    with psycopg.connect(_url_banco()) as conn:
        resultado = carregar_usuarios(conn, arquivo)
    print(f"{resultado.usuarios} usuários, {resultado.acessos} acessos")
    return 0


def _status() -> int:
    with psycopg.connect(_url_banco()) as conn:
        execucoes = conn.execute(
            "select id, iniciado_em, arquivo, status from import_run order by id desc limit 5"
        ).fetchall()
        reconciliacao = conn.execute(
            "select orc_bg, realizado, saldo, real_sem_orcamento from vw_reconciliacao"
        ).fetchone()

    linhas = [
        [str(id_run), iniciado.strftime("%Y-%m-%d %H:%M:%S"), arquivo, situacao]
        for id_run, iniciado, arquivo, situacao in execucoes
    ]
    print("Últimas importações:")
    print(_tabela(["id", "iniciado_em", "arquivo", "status"], linhas))
    if reconciliacao is not None:
        nomes = ["orc_bg", "realizado", "saldo", "real_sem_orcamento"]
        print()
        print("Reconciliação atual:")
        print(
            _tabela(
                ["controle", "valor"],
                [
                    [nome, formatar_valor(valor)]
                    for nome, valor in zip(nomes, reconciliacao, strict=True)
                ],
            )
        )
    return 0


def _montar_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="opex-etl", description="ETL do forecast Opex 2026.")
    comandos = parser.add_subparsers(dest="comando", required=True)

    gerar = comandos.add_parser("gerar-aliases", help="Gera ou atualiza o CSV de aliases.")
    gerar.add_argument("planilha", type=Path)
    gerar.add_argument("--saida", type=Path, default=ALIASES_PADRAO)

    validar_p = comandos.add_parser("validar", help="Valida a planilha e grava o relatório DQ.")
    validar_p.add_argument("planilha", type=Path)
    validar_p.add_argument("--aliases", type=Path, default=ALIASES_PADRAO)

    carregar_p = comandos.add_parser("carregar", help="Valida, carrega e reconcilia no banco.")
    carregar_p.add_argument("planilha", type=Path)
    carregar_p.add_argument("--aliases", type=Path, default=ALIASES_PADRAO)
    carregar_p.add_argument("--controles", type=Path, default=CONTROLES_PADRAO)

    usuarios_p = comandos.add_parser(
        "usuarios", help="Carrega a lista de acesso (usuários e permissões)."
    )
    usuarios_p.add_argument("arquivo", type=Path)

    comandos.add_parser("status", help="Mostra as últimas cargas e a reconciliação.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _montar_parser().parse_args(argv)
    try:
        if args.comando == "gerar-aliases":
            return _gerar_aliases(_resolver(args.planilha), _resolver(args.saida))
        if args.comando == "validar":
            return _validar(_resolver(args.planilha), _resolver(args.aliases))
        if args.comando == "carregar":
            return _carregar(
                _resolver(args.planilha), _resolver(args.aliases), _resolver(args.controles)
            )
        if args.comando == "usuarios":
            return _usuarios(_resolver(args.arquivo))
        return _status()
    except (ErroIngestao, AliasFaltanteError, FileNotFoundError, ValueError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 1
    except psycopg.OperationalError:
        print("Erro: não foi possível conectar ao banco (verifique DATABASE_URL).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
