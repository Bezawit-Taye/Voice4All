import asyncio
import logging
import os
import secrets
from typing import Literal

import aiohttp
import edge_tts
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

VOICE_BY_LANGUAGE = {
    "am": {
        "female": "am-ET-MekdesNeural",
        "male": "am-ET-AmehaNeural",
    },
    "en": {
        "female": "en-US-AriaNeural",
        "male": "en-US-GuyNeural",
    },
}
SPEECH_TIMEOUT_SECONDS = 90


class SpeechRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=2000)
    language: Literal["am", "en"] = "am"
    voice: Literal["female", "male"] = "female"
    rate: float = Field(default=1.0, ge=0.75, le=1.25)


app = FastAPI(title="Voice4All Edge TTS")


@app.get("/health")
async def health():
    if os.getenv("NODE_ENV") == "production" and not os.getenv("TTS_SERVICE_TOKEN"):
        raise HTTPException(
            status_code=503,
            detail="Speech service configuration is incomplete.",
        )
    return {"status": "ok"}


@app.post("/synthesize")
async def synthesize(
    request: SpeechRequest,
    authorization: str | None = Header(default=None),
):
    expected_token = os.getenv("TTS_SERVICE_TOKEN")
    if os.getenv("NODE_ENV") == "production" and not expected_token:
        raise HTTPException(
            status_code=503,
            detail="Speech service configuration is incomplete.",
        )
    if expected_token:
        scheme, _, supplied_token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not secrets.compare_digest(
            supplied_token, expected_token
        ):
            raise HTTPException(status_code=401, detail="Unauthorized.")

    communicator = edge_tts.Communicate(
        request.text,
        VOICE_BY_LANGUAGE[request.language][request.voice],
        rate=f"{round((request.rate - 1) * 100):+d}%",
    )
    try:
        audio = await asyncio.wait_for(
            _collect_audio(communicator),
            timeout=SPEECH_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as error:
        logger.warning("Edge TTS request timed out.")
        raise HTTPException(
            status_code=504,
            detail="Speech generation timed out.",
        ) from error
    except aiohttp.ClientError as error:
        logger.warning("Edge TTS network request failed: %s", type(error).__name__)
        raise HTTPException(
            status_code=503,
            detail="Speech provider is unavailable.",
        ) from error
    except edge_tts.exceptions.EdgeTTSException as error:
        logger.warning("Edge TTS request failed: %s", type(error).__name__)
        raise HTTPException(
            status_code=502,
            detail="Speech generation failed.",
        ) from error

    if not audio:
        raise HTTPException(status_code=502, detail="Speech generation failed.")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )


async def _collect_audio(communicator):
    audio = bytearray()
    async for message in communicator.stream():
        if message["type"] == "audio":
            audio.extend(message["data"])
    return bytes(audio)
