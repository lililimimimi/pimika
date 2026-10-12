"""
Execution preview endpoints.

The bridge pauses before the first write tool call and emits an
``execution_preview`` SSE event. These endpoints let the UI confirm or
cancel that preview. The bridge owns the pending-preview state, so both
calls are forwarded to it.

  POST /api/preview/{preview_id}/confirm
  POST /api/preview/{preview_id}/cancel
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.errors import NotFoundError, UpstreamError
from app.schemas import StatusResponse
from app.services.bridge import BRIDGE_URL
from app.services.local_http import local_client

router = APIRouter(prefix="/api")


class ConfirmRequest(BaseModel):
    # True: allow this command in this project from now on (shell commands only)
    remember: bool = False


async def _forward(
    preview_id: str, decision: str, body: dict[str, object] | None = None
) -> StatusResponse:
    url = f"{BRIDGE_URL}/preview/{preview_id}/{decision}"
    try:
        async with local_client(10.0) as client:
            resp = (
                await client.post(url, json=body)
                if body is not None
                else await client.post(url)
            )
    except httpx.HTTPError as exc:
        raise UpstreamError(f"Bridge unreachable: {exc}") from exc

    if resp.status_code == 404:
        raise NotFoundError(f"Preview '{preview_id}' not found")
    if resp.status_code >= 400:
        raise UpstreamError(f"Bridge error: {resp.status_code}")
    return StatusResponse(status="ok")


@router.post("/preview/{preview_id}/confirm")
async def confirm_preview(
    preview_id: str, req: ConfirmRequest | None = None
) -> StatusResponse:
    remember = req.remember if req is not None else False
    return await _forward(preview_id, "confirm", {"remember": remember})


@router.post("/preview/{preview_id}/cancel")
async def cancel_preview(preview_id: str) -> StatusResponse:
    return await _forward(preview_id, "cancel")
