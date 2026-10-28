"""Fixture de integração: banco limpo migrado pelo dbmate a cada teste.

Requer DATABASE_URL_TEST apontando para um banco descartável: o schema public é apagado.
"""

import shutil
import subprocess
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "db" / "migrations"


@pytest.fixture
def conn(db_url: str) -> Iterator[psycopg.Connection]:
    if shutil.which("dbmate") is None:
        pytest.skip("dbmate não instalado")

    with psycopg.connect(db_url) as reset:
        reset.execute("drop schema public cascade; create schema public;")
        reset.commit()

    subprocess.run(
        [
            "dbmate",
            "--url",
            db_url,
            "--migrations-dir",
            str(MIGRATIONS_DIR),
            "--no-dump-schema",
            "up",
        ],
        check=True,
    )

    connection = psycopg.connect(db_url)
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()
