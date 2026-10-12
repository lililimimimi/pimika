"""
Model routes.

  GET  /api/models              → models the user enabled in Settings (for the top-right picker)
  GET  /api/models/catalog      → every known model, with enabled flag and last test (for Settings)
  PUT  /api/models/enabled      → save which models are enabled for one provider
  POST /api/models/test         → send one short prompt to a model; result is saved
  GET  /api/models/default      → the model to use when nothing is selected yet
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.config.selected_model import get_selected_model, set_selected_model
from app.config.store import known_provider
from app.errors import InvalidRequestError
from app.logging import get_logger
from app.schemas import DefaultModelResponse, EnabledModelsResponse, ModelTestResponse
from app.services.bridge import BridgeError, bridge_call
from app.services.catalog import (
    build_catalog,
    enabled_models,
    run_model_test,
    save_enabled_models,
)

router = APIRouter(prefix="/api")


log = get_logger(__name__)


class EnabledModelsUpdate(BaseModel):
    provider: str
    models: list[str]


@router.get("/models")
async def list_models() -> list[dict[str, Any]]:
    return await enabled_models()


@router.get("/models/catalog")
async def model_catalog() -> list[dict[str, Any]]:
    return await build_catalog()


@router.put("/models/enabled")
async def set_enabled_models(body: EnabledModelsUpdate) -> EnabledModelsResponse:
    if not known_provider(body.provider):
        raise InvalidRequestError(f"Unknown provider: {body.provider}")
    return EnabledModelsResponse(
        ok=True, enabled=save_enabled_models(body.provider, body.models)
    )


@router.get("/models/selected")
async def read_selected_model() -> dict[str, str | None]:
    """The model the user picked last, or nulls if they have not picked one."""
    picked = get_selected_model()
    if picked is None:
        return {"provider": None, "model": None}
    return {"provider": picked[0], "model": picked[1]}


@router.put("/models/selected")
async def write_selected_model(body: dict[str, Any]) -> dict[str, str]:
    """Save the model the user picked, so the browser and the desktop window agree."""
    provider, model = (
        str(body.get("provider") or "").strip(),
        str(body.get("model") or "").strip(),
    )
    if not provider or not model:
        raise InvalidRequestError("provider and model are required")
    set_selected_model(provider, model)
    return {"status": "ok"}


@router.get("/models/default")
async def get_default_model() -> DefaultModelResponse:
    """The model the user picked; otherwise the first enabled model, so the picker always shows something."""
    picked = get_selected_model()
    if picked is not None:
        return DefaultModelResponse(provider=picked[0], model=picked[1])
    enabled = await enabled_models()
    if enabled:
        return DefaultModelResponse(
            provider=enabled[0]["provider"], model=enabled[0]["id"]
        )
    try:
        reply = await bridge_call("GET", "/models/default", timeout=3.0)
        if isinstance(reply, dict) and "provider" in reply and "model" in reply:
            return DefaultModelResponse(
                provider=str(reply["provider"]), model=str(reply["model"])
            )
    except BridgeError as e:
        log.warning(
            "bridge did not give a default model, using the built-in one: {}", e
        )
    return DefaultModelResponse(provider="pi", model="claude-sonnet-4-5")


@router.post("/models/test")
async def test_model(body: dict[str, Any]) -> ModelTestResponse:
    result = await run_model_test(body)
    return ModelTestResponse(
        ok=bool(result.get("ok")), error=result.get("error"), ms=result.get("ms")
    )
