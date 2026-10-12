"""
The Pi (Claude.ai) login has two tokens. The access token lasts about a day; the refresh token
renews it. An expired access token with a refresh token is still a working login, and the
status line should say so instead of showing an alarming old date.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from app.config import pi_oauth
from app.config.pi_oauth import is_available, login_state
from app.config.store import load_config
from app.config.sync import sync_pi_oauth_to_config


@pytest.fixture
def auth_file(tmp_path: Path, monkeypatch) -> Path:
    path = tmp_path / "auth.json"
    monkeypatch.setattr(pi_oauth, "_AUTH_PATH", path)
    monkeypatch.setattr(
        "app.config.store._config_path", lambda: tmp_path / "config.json"
    )
    return path


def _write(
    path: Path, *, access: str | None, refresh: str | None, expires_in_days: float
) -> None:
    entry: dict[str, object] = {
        "type": "oauth",
        "expires": int((time.time() + expires_in_days * 86400) * 1000),
    }
    if access is not None:
        entry["access"] = access
    if refresh is not None:
        entry["refresh"] = refresh
    path.write_text(json.dumps({"anthropic": entry}))


def test_no_login_file_means_missing(auth_file: Path):
    assert login_state() == "missing"
    assert is_available() is False


def test_a_fresh_access_token_is_valid(auth_file: Path):
    _write(auth_file, access="a", refresh="r", expires_in_days=1)
    assert login_state() == "valid"
    assert is_available() is True


def test_an_expired_access_token_with_a_refresh_token_is_renewable_and_still_connected(
    auth_file: Path,
):
    _write(auth_file, access="a", refresh="r", expires_in_days=-2)
    assert login_state() == "renewable"
    assert is_available() is True


def test_an_expired_login_with_nothing_to_renew_it_is_not_connected(auth_file: Path):
    _write(auth_file, access="a", refresh=None, expires_in_days=-2)
    assert login_state() == "expired"
    assert is_available() is False


def test_the_status_line_says_it_renews_itself(auth_file: Path):
    _write(auth_file, access="a", refresh="r", expires_in_days=-2)
    sync_pi_oauth_to_config()
    p = load_config()["providers"]["pi"]
    assert p["connected"] is True
    assert "renews automatically" in p["note"]


def test_the_status_line_shows_the_date_while_the_token_is_valid(auth_file: Path):
    _write(auth_file, access="a", refresh="r", expires_in_days=1)
    sync_pi_oauth_to_config()
    assert "valid until" in load_config()["providers"]["pi"]["note"]
