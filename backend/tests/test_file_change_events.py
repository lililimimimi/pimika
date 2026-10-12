"""
The bridge's file_change events reach the browser unchanged, and do not count as reply text.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

from app.services.chat_stream import _Outcome, _pass_events

FILE_CHANGE = {
    "event": "file_change",
    "data": {
        "path": "/work/app.txt",
        "before": "old\n",
        "after": "new\n",
        "is_new": False,
    },
}


class _FakeResponse:
    def __init__(self, lines: list[str]):
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line


async def test_file_change_event_is_forwarded_unchanged_and_is_not_reply_text():
    line = f"data: {json.dumps(FILE_CHANGE)}"
    resp = _FakeResponse([line])
    session = SimpleNamespace(
        stopped=False, reply_parts=[], tool_calls=[], tool_results=[], file_changes=[]
    )
    outcome = _Outcome()

    chunks = [chunk async for chunk in _pass_events(resp, session, outcome)]

    assert chunks == [f"{line}\n\n"]
    assert outcome.text == []
    assert session.reply_parts == []
    assert session.file_changes == [FILE_CHANGE["data"]]
