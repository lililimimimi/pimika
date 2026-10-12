"""HTTP client for services on this computer (the bridge, the packaged backend).

It ignores the system proxy: a proxy app (such as Clash) answers 502 for 127.0.0.1,
so a local request would never reach the bridge.
"""

from __future__ import annotations

from typing import Any

import httpx


def local_client(timeout: float | None, **kwargs: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, trust_env=False, **kwargs)
