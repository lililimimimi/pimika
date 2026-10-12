"""
A saved reply keeps its tool calls, tool results and file changes, so they are there after a reload.
"""

from __future__ import annotations

import json

from app.services.chat_sessions import ChatSession
from app.services.chat_stream import _Outcome, _pass_events
from app.sessions import store

TOOL_CALL = {
    "event": "tool_call",
    "data": {"tool_call_id": "t1", "tool_name": "edit", "arguments": {"path": "a.txt"}},
}
TOOL_RESULT = {
    "event": "tool_result",
    "data": {"tool_call_id": "t1", "output": "ok", "is_error": False},
}
FILE_CHANGE = {
    "event": "file_change",
    "data": {"path": "/w/a.txt", "before": "old\n", "after": "new\n", "is_new": False},
}


class _FakeResponse:
    def __init__(self, lines: list[str]):
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line


def _new_chat(session_id: str) -> ChatSession:
    return ChatSession(
        session_id="chat-1", messages=[], provider="p", model="m", persist_id=session_id
    )


async def test_tool_events_are_kept_on_the_session_while_the_turn_streams():
    lines = [f"data: {json.dumps(e)}" for e in (TOOL_CALL, TOOL_RESULT, FILE_CHANGE)]
    chat = _new_chat("unused")

    [chunk async for chunk in _pass_events(_FakeResponse(lines), chat, _Outcome())]

    assert chat.tool_calls == [
        {"tool_call_id": "t1", "tool_name": "edit", "arguments": {"path": "a.txt"}}
    ]
    assert chat.tool_results == [
        {"tool_call_id": "t1", "output": "ok", "is_error": False}
    ]
    assert chat.file_changes == [
        {"path": "/w/a.txt", "before": "old\n", "after": "new\n", "is_new": False}
    ]


async def test_reply_with_tools_survives_a_reload():
    meta = store.create_session(title="chat")
    chat = _new_chat(meta.id)
    chat.reply_parts.append("Done.")
    chat.tool_calls.append(TOOL_CALL["data"])
    chat.tool_results.append(TOOL_RESULT["data"])
    chat.file_changes.append(FILE_CHANGE["data"])

    chat.save_reply()

    reply = [r for r in store.get_session(meta.id) if r.get("role") == "assistant"]
    assert len(reply) == 1
    assert reply[0]["content"] == "Done."
    assert reply[0]["tool_calls"] == [TOOL_CALL["data"]]
    assert reply[0]["tool_results"] == [TOOL_RESULT["data"]]
    assert reply[0]["file_changes"] == [FILE_CHANGE["data"]]


async def test_a_reply_with_only_tool_calls_is_still_saved():
    meta = store.create_session(title="chat")
    chat = _new_chat(meta.id)
    chat.tool_calls.append(TOOL_CALL["data"])

    chat.save_reply()

    reply = [r for r in store.get_session(meta.id) if r.get("role") == "assistant"]
    assert len(reply) == 1
    assert reply[0]["tool_calls"] == [TOOL_CALL["data"]]


async def test_text_only_reply_keeps_the_plain_format():
    meta = store.create_session(title="chat")
    chat = _new_chat(meta.id)
    chat.reply_parts.append("Just text.")

    chat.save_reply()

    reply = [r for r in store.get_session(meta.id) if r.get("role") == "assistant"]
    assert "tool_calls" not in reply[0]
    assert "tool_results" not in reply[0]
    assert "file_changes" not in reply[0]


async def test_nothing_is_saved_for_an_empty_turn():
    meta = store.create_session(title="chat")
    chat = _new_chat(meta.id)

    chat.save_reply()

    assert [r for r in store.get_session(meta.id) if r.get("type") == "message"] == []
