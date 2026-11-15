import io
import os
from contextlib import asynccontextmanager
from threading import Lock
from typing import Literal

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from omnivoice import OmniVoice
from pydantic import BaseModel, Field

MODEL_ID = os.getenv("OMNIVOICE_MODEL", "k2-fsa/OmniVoice")
MODEL = None
MODEL_LOCK = Lock()


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    language: Literal["am", "en"] = "am"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global MODEL
    device = os.getenv("OMNIVOICE_DEVICE")
    if not device:
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device.startswith(("cuda", "xpu")) else torch.float32
    MODEL = OmniVoice.from_pretrained(MODEL_ID, device_map=device, dtype=dtype)
    yield
    MODEL = None


app = FastAPI(title="Voice4All OmniVoice TTS", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok" if MODEL is not None else "loading", "model": MODEL_ID}


@app.post("/synthesize")
def synthesize(request: SpeechRequest):
    if MODEL is None:
        raise HTTPException(status_code=503, detail="OmniVoice model is not loaded.")

    with MODEL_LOCK:
        audio_chunks = MODEL.generate(
            text=request.text.strip(),
            language=request.language,
            num_step=16,
        )

    if not audio_chunks:
        raise HTTPException(status_code=502, detail="OmniVoice generated no audio.")

    output = io.BytesIO()
    sf.write(
        output,
        np.asarray(audio_chunks[0]),
        MODEL.sampling_rate,
        format="WAV",
        subtype="PCM_16",
    )
    return Response(content=output.getvalue(), media_type="audio/wav")
