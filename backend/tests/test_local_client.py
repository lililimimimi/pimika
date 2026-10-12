"""
Calls to the bridge stay on this computer. They must not go through the system proxy: on a
Mac with a proxy app, a proxy answers 502 for 127.0.0.1 and the chat fails.
"""

from __future__ import annotations

from app.services.local_http import local_client


def test_the_local_client_ignores_the_system_proxy():
    assert local_client(timeout=5.0).trust_env is False


def test_the_local_client_keeps_the_timeout_it_was_given():
    assert local_client(timeout=None).timeout.read is None
