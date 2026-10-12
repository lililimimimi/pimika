"""
The packaged app starts the backend with a secret token (PI_APP_TOKEN). Every request must
carry it in the X-Pi-Token header, so a web page that is not the app cannot use the backend.
Without the setting (development), nothing is checked.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import token_ok


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def test_no_token_is_required_when_none_is_configured():
    assert token_ok(None, None) is True
    assert token_ok("", None) is True


def test_a_matching_token_is_accepted_and_others_are_not():
    assert token_ok("s3cret", "s3cret") is True
    assert token_ok("s3cret", "wrong") is False
    assert token_ok("s3cret", None) is False


async def test_request_without_token_is_refused_when_configured(
    client: AsyncClient, monkeypatch
):
    monkeypatch.setenv("PI_APP_TOKEN", "s3cret")
    r = await client.get("/api/health")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


async def test_request_with_the_token_is_served(client: AsyncClient, monkeypatch):
    monkeypatch.setenv("PI_APP_TOKEN", "s3cret")
    r = await client.get("/api/health", headers={"X-Pi-Token": "s3cret"})
    assert r.status_code == 200


async def test_requests_are_open_when_no_token_is_configured(
    client: AsyncClient, monkeypatch
):
    monkeypatch.delenv("PI_APP_TOKEN", raising=False)
    r = await client.get("/api/health")
    assert r.status_code == 200


async def test_cors_preflight_is_not_blocked_by_the_token(
    client: AsyncClient, monkeypatch
):
    monkeypatch.setenv("PI_APP_TOKEN", "s3cret")
    r = await client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-pi-token",
        },
    )
    assert r.status_code == 200
