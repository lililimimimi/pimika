"""
The model the user picked is kept by the backend, so the browser and the desktop window
both start with the same choice (each window has its own browser storage).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture(autouse=True)
def _isolated_config(tmp_path: Path, monkeypatch):
    path = tmp_path / "config.json"
    monkeypatch.setattr("app.config.store._config_path", lambda: path)
    return path


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


async def test_nothing_is_selected_at_first(client: AsyncClient):
    r = await client.get("/api/models/selected")
    assert r.status_code == 200
    assert r.json() == {"provider": None, "model": None}


async def test_a_selection_is_saved_and_read_back(client: AsyncClient):
    r = await client.put(
        "/api/models/selected", json={"provider": "deepseek", "model": "deepseek-chat"}
    )
    assert r.status_code == 200
    r = await client.get("/api/models/selected")
    assert r.json() == {"provider": "deepseek", "model": "deepseek-chat"}


async def test_the_saved_selection_is_the_default_for_every_window(client: AsyncClient):
    await client.put(
        "/api/models/selected", json={"provider": "deepseek", "model": "deepseek-chat"}
    )
    r = await client.get("/api/models/default")
    assert r.json() == {"provider": "deepseek", "model": "deepseek-chat"}


async def test_an_empty_selection_is_refused(client: AsyncClient):
    r = await client.put("/api/models/selected", json={"provider": "", "model": "x"})
    assert r.status_code == 400


async def test_saving_keeps_the_api_keys_already_in_the_config(
    client: AsyncClient, _isolated_config: Path
):
    import json

    _isolated_config.write_text(
        json.dumps({"providers": {"deepseek": {"api_key": "sk-test-keep"}}})
    )
    await client.put(
        "/api/models/selected", json={"provider": "deepseek", "model": "deepseek-chat"}
    )
    saved = json.loads(_isolated_config.read_text())
    assert saved["providers"]["deepseek"]["api_key"] == "sk-test-keep"
    assert saved["selected_model"] == {"provider": "deepseek", "model": "deepseek-chat"}
