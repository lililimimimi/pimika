"""Which web pages may call the backend. Anything not listed here is refused."""

from __future__ import annotations

# The Vite dev server, the only page that talks to the backend during development
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def allowed_origins(env_value: str | None) -> list[str]:
    """CORS_ORIGINS (comma separated) replaces the default; the packaged app sets it to its own origin."""
    if not env_value or not env_value.strip():
        return list(DEV_ORIGINS)
    return [origin.strip() for origin in env_value.split(",") if origin.strip()]
