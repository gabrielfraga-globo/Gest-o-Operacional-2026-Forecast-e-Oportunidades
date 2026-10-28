import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
if _ENV_FILE.exists():
    load_dotenv(_ENV_FILE)


@pytest.fixture(scope="session")
def db_url() -> str:
    url = os.environ.get("DATABASE_URL_TEST")
    if not url:
        pytest.skip("DATABASE_URL_TEST não definido")
    return url


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if os.environ.get("DATABASE_URL_TEST"):
        return
    skip = pytest.mark.skip(reason="DATABASE_URL_TEST não definido")
    for item in items:
        if item.get_closest_marker("integration"):
            item.add_marker(skip)
