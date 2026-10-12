"""
Stop ends a reply that is waiting on the bridge, even when the bridge sends nothing more.

The fake bridge waits for a confirmation that never comes. Closing its stream (what Stop does)
must end the wait; the test never releases the bridge itself.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.sessions import store


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _blocked_bridge(closed: asyncio.Event) -> MagicMock:
    """A bridge that sends some text, then waits. Closing its response ends the wait."""

    async def _lines():
        yield 'data: {"event": "text", "data": {"content": "Partial "}}'
        await closed.wait()
        # What httpx really raises when the response is closed under a read (seen in the server log)
        raise httpx.ReadError("stream closed")

    resp = AsyncMock()
    resp.status_code = 200
    resp.aiter_lines = _lines
    resp.aclose = AsyncMock(side_effect=lambda: closed.set())

    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=resp)
    ctx.__aexit__ = AsyncMock(return_value=False)

    client_instance = AsyncMock()
    client_instance.stream = MagicMock(return_value=ctx)
    client_instance.__aenter__ = AsyncMock(return_value=client_instance)
    client_instance.__aexit__ = AsyncMock(return_value=False)
    client_instance.resp = resp
    return client_instance


async def test_stop_ends_a_stream_that_is_waiting_on_the_bridge(client: AsyncClient):
    r = await client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "provider": "mock",
            "model": "mock-1",
        },
    )
    session_id, persist_id = r.json()["session_id"], r.json()["persist_id"]

    bridge = _blocked_bridge(asyncio.Event())
    with patch("app.services.chat_stream.httpx.AsyncClient", return_value=bridge):
        stream_task = asyncio.create_task(client.get(f"/api/chat/stream/{session_id}"))
        await asyncio.sleep(
            0.05
        )  # "Partial " arrives, and the stream waits for the bridge

        stop = await client.post(f"/api/chat/stop/{session_id}")
        assert stop.status_code == 200

        # Without the fix the stream never ends, and this times out
        await asyncio.wait_for(stream_task, timeout=2)

    bridge.resp.aclose.assert_awaited_once()
    texts = [
        r["content"]
        for r in store.get_session(persist_id)
        if r.get("type") == "message" and r.get("role") == "assistant"
    ]
    assert texts == ["Partial "]
