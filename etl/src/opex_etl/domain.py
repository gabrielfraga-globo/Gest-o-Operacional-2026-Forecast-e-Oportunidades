"""Constantes e funções puras do domínio do forecast Opex.

Sem I/O e sem pandas: apenas vocabulário, mapeamentos e conversões.
"""

from enum import StrEnum


class Cen2(StrEnum):
    ORC_BG = "ORC_BG"
    REAL = "REAL"


_CEN2_PLANILHA: dict[str, Cen2] = {
    "ORC+BG": Cen2.ORC_BG,
    "REAL": Cen2.REAL,
}


def cen2_da_planilha(valor: str) -> Cen2:
    chave = valor.strip()
    if chave not in _CEN2_PLANILHA:
        raise ValueError(f"CEN2 inválido: {valor!r}")
    return _CEN2_PLANILHA[chave]


class Classificacao(StrEnum):
    COMPROMISSO = "COMPROMISSO"
    POSTERGACAO = "POSTERGACAO"
    CANCELAMENTO = "CANCELAMENTO"
    ECONOMIA = "ECONOMIA"
    A_VALIDAR = "A_VALIDAR"


class Confianca(StrEnum):
    ALTA = "ALTA"
    MEDIA = "MEDIA"
    BAIXA = "BAIXA"


class Categoria(StrEnum):
    OPORTUNIDADE = "OPORTUNIDADE"
    COMPROMISSO = "COMPROMISSO"
    PRESSAO = "PRESSAO"
    A_VALIDAR = "A_VALIDAR"


class Severidade(StrEnum):
    ERROR = "ERROR"
    WARN = "WARN"


MESES_PT: dict[str, int] = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

_ALIAS_MESES_PT: dict[str, str] = {"marco": "março"}


def mes_para_int(nome: str) -> int:
    chave = nome.strip().lower()
    chave = _ALIAS_MESES_PT.get(chave, chave)
    if chave not in MESES_PT:
        raise ValueError(f"Mês inválido: {nome!r}")
    return MESES_PT[chave]


ABA_BASE = "Base"
LINHA_CABECALHO = 1  # zero-based, para pandas header=

COLUNAS_BASE: dict[str, str] = {
    "Nome da Origem": "origem",
    "Cenário": "cenario",
    "CEN2": "cen2",
    "Centro de Custo": "centro_custo",
    "Conta": "conta",
    "Projeto": "projeto",
    "Finalidade": "finalidade",
    "Grupo": "grupo",
    "Fornecedor": "fornecedor",
    "Mês": "mes",
    "Valor": "valor",
    "DS_LINHA_LANCTO_CONTABIL": "lancamento",
    "OC/RC": "oc_rc",
    "DT_CONTABILIZACAO": "dt_contabilizacao",
    "N4": "n4",
    "N5": "n5",
}

COLUNAS_OBRIGATORIAS: tuple[str, ...] = (
    "cenario",
    "cen2",
    "centro_custo",
    "conta",
    "projeto",
    "n4",
    "mes",
    "valor",
)

CAMPOS_ROW_KEY: tuple[str, ...] = (
    "origem",
    "cenario",
    "cen2",
    "centro_custo",
    "conta",
    "projeto",
    "finalidade",
    "fornecedor",
    "n4",
    "n5",
    "mes",
    "valor",
    "lancamento",
    "oc_rc",
)

PROJETO_REAL_SEM_ORCAMENTO = "__REAL_SEM_ORC__"
NOME_REAL_SEM_ORCAMENTO = "INDIRETO — REAL SEM ORÇAMENTO"
