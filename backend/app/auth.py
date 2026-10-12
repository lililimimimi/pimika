"""The app token: a secret the packaged app gives to its backend and its own window."""

from __future__ import annotations

import hmac


def token_ok(expected: str | None, provided: str | None) -> bool:
    """True when no token is configured, or when the provided token matches it exactly."""
    if not expected:
        return True
    return provided is not None and hmac.compare_digest(expected, provided)
