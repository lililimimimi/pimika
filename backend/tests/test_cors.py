"""
Cross-origin rules: other websites must not be able to read the backend's answers.

The app's own pages come from the Vite dev server (5173) or from the packaged window
(its own origin, given through CORS_ORIGINS). Nothing else is allowed by default.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.cors import allowed_origins


def test_default_allows_only_the_local_dev_pages():
    assert allowed_origins(None) == ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert allowed_origins("") == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_wildcard_is_never_the_default():
    assert "*" not in allowed_origins(None)


def test_environment_setting_replaces_the_default():
    assert allowed_origins("tauri://localhost, http://tauri.localhost") == [
        "tauri://localhost",
        "http://tauri.localhost",
    ]


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


async def test_another_website_gets_no_cross_origin_permission(client: AsyncClient):
    r = await client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert r.status_code == 200
    assert "access-control-allow-origin" not in r.headers


async def test_the_local_dev_page_is_allowed(client: AsyncClient):
    r = await client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
