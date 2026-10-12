"""The model the user picked last, kept in config.json so every window starts with it."""

from __future__ import annotations

from app.config.store import load_config, save_config


def get_selected_model() -> tuple[str, str] | None:
    """(provider, model) the user picked, or None if they have not picked one yet."""
    saved = load_config().get("selected_model")
    if not isinstance(saved, dict):
        return None
    provider, model = saved.get("provider"), saved.get("model")
    if not provider or not model:
        return None
    return str(provider), str(model)


def set_selected_model(provider: str, model: str) -> None:
    """Save the pick. The rest of config.json (API keys and so on) is kept as it is."""
    config = load_config()
    config["selected_model"] = {"provider": provider, "model": model}
    save_config(config)
