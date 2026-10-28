"""Lista de acesso: carrega usuários e permissões de edição a partir de um CSV."""

import csv
import io
from dataclasses import dataclass
from pathlib import Path

import psycopg

PAPEIS = ("admin", "responsavel")
COLUNAS = ("email", "nome", "papel", "n4", "projeto_codigo")


class ErroUsuariosError(ValueError):
    """Arquivo de usuários inválido. Lista todos os problemas, cada um com a linha do CSV."""

    def __init__(self, problemas: list[str]) -> None:
        self.problemas = problemas
        detalhes = "\n".join(f"  {problema}" for problema in problemas)
        super().__init__(f"Arquivo de usuários inválido:\n{detalhes}")


@dataclass(frozen=True)
class LinhaUsuario:
    numero: int
    email: str
    nome: str
    papel: str
    n4: str | None
    projeto_codigo: str | None


@dataclass(frozen=True)
class ResultadoUsuarios:
    usuarios: int
    acessos: int


@dataclass(frozen=True)
class _Acesso:
    email: str
    n4_id: int
    projeto_id: int | None


def ler_usuarios(caminho: Path) -> list[LinhaUsuario]:
    try:
        texto = caminho.read_bytes().decode("utf-8-sig")
    except UnicodeDecodeError as erro:
        raise ErroUsuariosError([f"arquivo não está em UTF-8 ({erro.reason})"]) from erro
    return validar_usuarios(texto)


def validar_usuarios(texto: str) -> list[LinhaUsuario]:
    leitor = csv.reader(io.StringIO(texto, newline=""))
    cabecalho_lido = next(leitor, None)
    if cabecalho_lido is None:
        raise ErroUsuariosError(["arquivo vazio"])

    cabecalho = [coluna.strip().lower() for coluna in cabecalho_lido]
    faltantes = [coluna for coluna in COLUNAS if coluna not in cabecalho]
    if faltantes:
        raise ErroUsuariosError([f"cabeçalho sem as colunas: {', '.join(faltantes)}"])
    posicao = {coluna: cabecalho.index(coluna) for coluna in COLUNAS}

    problemas: list[str] = []
    linhas: list[LinhaUsuario] = []
    dados_por_email: dict[str, tuple[str, str, int]] = {}
    numero_por_acesso: dict[tuple[str, str | None, str | None], int] = {}

    for registro in leitor:
        numero = leitor.line_num
        if not any(celula.strip() for celula in registro):
            continue
        if len(registro) != len(cabecalho):
            problemas.append(
                f"linha {numero}: esperadas {len(cabecalho)} colunas, encontradas {len(registro)}"
            )
            continue

        valores = {coluna: registro[posicao[coluna]].strip() for coluna in COLUNAS}
        erros_linha = _erros_da_linha(valores, numero)
        if erros_linha:
            problemas.extend(erros_linha)
            continue

        email = valores["email"].lower()
        nome = valores["nome"]
        papel = valores["papel"].lower()
        n4 = valores["n4"] or None
        projeto_codigo = valores["projeto_codigo"] or None

        anterior = dados_por_email.get(email)
        if anterior is None:
            dados_por_email[email] = (nome, papel, numero)
        elif anterior[:2] != (nome, papel):
            problemas.append(
                f"linha {numero}: e-mail {email} tem nome ou papel diferente da linha {anterior[2]}"
            )
            continue

        chave = (email, n4, projeto_codigo)
        if chave in numero_por_acesso:
            problemas.append(
                f"linha {numero}: acesso duplicado (igual à linha {numero_por_acesso[chave]})"
            )
            continue
        numero_por_acesso[chave] = numero

        linhas.append(LinhaUsuario(numero, email, nome, papel, n4, projeto_codigo))

    if problemas:
        raise ErroUsuariosError(problemas)
    if not linhas:
        raise ErroUsuariosError(["nenhum usuário encontrado no arquivo"])
    return linhas


def _erros_da_linha(valores: dict[str, str], numero: int) -> list[str]:
    erros: list[str] = []
    email = valores["email"].lower()
    if not email:
        erros.append(f"linha {numero}: e-mail vazio")
    elif "@" not in email or " " in email:
        erros.append(f"linha {numero}: e-mail inválido '{valores['email']}'")
    if not valores["nome"]:
        erros.append(f"linha {numero}: nome vazio")

    papel = valores["papel"].lower()
    if papel not in PAPEIS:
        erros.append(
            f"linha {numero}: papel '{valores['papel']}' inválido (use admin ou responsavel)"
        )
    elif papel == "admin" and (valores["n4"] or valores["projeto_codigo"]):
        erros.append(
            f"linha {numero}: admin não recebe N4 nem projeto (deixe n4 e projeto_codigo vazios)"
        )
    elif papel == "responsavel" and not valores["n4"]:
        erros.append(f"linha {numero}: responsável exige n4")
    return erros


def carregar_usuarios(conn: psycopg.Connection, caminho: Path) -> ResultadoUsuarios:
    linhas = ler_usuarios(caminho)
    acessos, problemas = _resolver(conn, linhas)
    if problemas:
        raise ErroUsuariosError(problemas)

    usuarios = {linha.email: (linha.nome, linha.papel) for linha in linhas}
    with conn.transaction():
        _gravar(conn, usuarios, acessos)
    return ResultadoUsuarios(usuarios=len(usuarios), acessos=len(acessos))


def _resolver(
    conn: psycopg.Connection, linhas: list[LinhaUsuario]
) -> tuple[list[_Acesso], list[str]]:
    n4_por_nome = {
        nome: int(n4_id) for n4_id, nome in conn.execute("select n4_id, nome from dim_n4")
    }
    projeto_por_codigo = {
        codigo: int(projeto_id)
        for projeto_id, codigo in conn.execute("select projeto_id, codigo from dim_projeto")
    }
    pares_n4_projeto = {
        (int(n4_id), int(projeto_id))
        for n4_id, projeto_id in conn.execute(
            "select distinct n4_id, projeto_id from forecast_linha"
        )
    }

    acessos: list[_Acesso] = []
    problemas: list[str] = []
    for linha in linhas:
        if linha.n4 is None:
            continue
        n4_id = n4_por_nome.get(linha.n4)
        if n4_id is None:
            problemas.append(f"linha {linha.numero}: N4 '{linha.n4}' não existe em dim_n4")
            continue

        projeto_id: int | None = None
        if linha.projeto_codigo is not None:
            projeto_id = projeto_por_codigo.get(linha.projeto_codigo)
            if projeto_id is None:
                problemas.append(
                    f"linha {linha.numero}: projeto '{linha.projeto_codigo}' "
                    "não existe em dim_projeto"
                )
                continue
            if (n4_id, projeto_id) not in pares_n4_projeto:
                problemas.append(
                    f"linha {linha.numero}: projeto '{linha.projeto_codigo}' não pertence ao N4 "
                    f"'{linha.n4}' (não há linha em forecast_linha)"
                )
                continue

        acessos.append(_Acesso(linha.email, n4_id, projeto_id))
    return acessos, problemas


def _gravar(
    conn: psycopg.Connection,
    usuarios: dict[str, tuple[str, str]],
    acessos: list[_Acesso],
) -> None:
    for email, (nome, papel) in usuarios.items():
        conn.execute(
            "insert into usuario (email, nome, papel) values (%s, %s, %s) "
            "on conflict (email) do update set nome = excluded.nome, papel = excluded.papel",
            (email, nome, papel),
        )

    conn.execute("delete from usuario_acesso where email = any(%s)", (list(usuarios),))
    for acesso in acessos:
        conn.execute(
            "insert into usuario_acesso (email, n4_id, projeto_id) values (%s, %s, %s)",
            (acesso.email, acesso.n4_id, acesso.projeto_id),
        )

    for email, (nome, _papel) in usuarios.items():
        conn.execute(
            'insert into "user" (id, email, name, "emailVerified", "createdAt", "updatedAt") '
            "values (gen_random_uuid()::text, %s, %s, false, now(), now()) "
            'on conflict (email) do update set name = excluded.name, "updatedAt" = now()',
            (email, nome),
        )
