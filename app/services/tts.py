from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

import requests
from fastapi import HTTPException


def _resolve_binary(binary_env: str) -> Optional[str]:
    """
    Resolve the configured binary path. Accepts absolute paths or relies on PATH.
    """
    binary_env = binary_env.strip()
    candidate = Path(binary_env)
    if candidate.exists():
        return str(candidate)
    resolved = shutil.which(binary_env)
    return resolved


def synthesize_with_piper(text: str, language: Optional[str] = None) -> bytes:
    """
    Invokes the Piper CLI to synthesize audio for the given text.
    Requires two environment variables:
      - PIPER_MODEL_PATH: path to the .onnx model file
      - PIPER_BIN (optional): path or name of the Piper executable (defaults to 'piper')
    Returns the resulting WAV bytes.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Texto vazio para síntese.")

    model_path = os.getenv("PIPER_MODEL_PATH")
    if not model_path:
        raise HTTPException(
            status_code=503,
            detail="PIPER_MODEL_PATH não definido. Configure o caminho do modelo Piper.",
        )
    model = Path(model_path)
    if not model.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Modelo Piper não encontrado em {model}",
        )

    binary_env = os.getenv("PIPER_BIN", "piper")
    binary_path = _resolve_binary(binary_env)
    if not binary_path:
        raise HTTPException(
            status_code=503,
            detail=f"Binário Piper '{binary_env}' não localizado. Instale o Piper e ajuste PIPER_BIN.",
        )

    # Piper recebe texto em stdin; podemos opcionalmente informar idioma futuro.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_out:
        tmp_path = Path(tmp_out.name)

    try:
        cmd = [
            binary_path,
            "--model",
            str(model),
            "--output_file",
            str(tmp_path),
        ]

        proc = subprocess.run(
            cmd,
            input=text,
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Falha ao sintetizar com Piper: {proc.stderr.strip() or proc.stdout.strip()}",
            )
        data = tmp_path.read_bytes()
        if not data:
            raise HTTPException(status_code=500, detail="Piper não retornou áudio.")
        return data
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


_ELEVENLABS_DEFAULT_VOICES: Dict[str, Dict[str, Any]] = {
    "pt": {
        "voice_id": os.getenv("ELEVENLABS_VOICE_ID_PT") or os.getenv("ELEVENLABS_VOICE_ID") or "EXAVITQu4vr4xnSDxMaL",
        "model_id": os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2",
        "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.5")),
        "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY", "0.8")),
        "style": float(os.getenv("ELEVENLABS_STYLE", "0.0")),
    },
    "en": {
        "voice_id": os.getenv("ELEVENLABS_VOICE_ID_EN") or os.getenv("ELEVENLABS_VOICE_ID") or "9BWtsMINqrJLrRacOk9x",
        "model_id": os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2",
        "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.5")),
        "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY", "0.8")),
        "style": float(os.getenv("ELEVENLABS_STYLE", "0.0")),
    },
    "es": {
        "voice_id": os.getenv("ELEVENLABS_VOICE_ID_ES") or os.getenv("ELEVENLABS_VOICE_ID") or "XB0fDUnXU5powFXDhCwa",
        "model_id": os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2",
        "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.5")),
        "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY", "0.8")),
        "style": float(os.getenv("ELEVENLABS_STYLE", "0.0")),
    },
}


def is_elevenlabs_configured() -> bool:
    """Check if the ElevenLabs API key is available in env."""
    return bool(os.getenv("ELEVENLABS_API_KEY"))


def _resolve_language(language: Optional[str]) -> str:
    if not language:
        return "pt"
    lang = language.lower()
    if "-" in lang:
        lang = lang.split("-", 1)[0]
    return lang


def synthesize_with_elevenlabs(text: str, language: Optional[str] = None) -> bytes:
    """
    Call ElevenLabs using the server-side API key so the frontend never needs to expose it.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Texto vazio para síntese.")

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ElevenLabs não configurado no backend.")

    normalized_lang = _resolve_language(language)
    voice_cfg = _ELEVENLABS_DEFAULT_VOICES.get(normalized_lang) or _ELEVENLABS_DEFAULT_VOICES["pt"]

    payload = {
        "text": text,
        "model_id": voice_cfg["model_id"],
        "voice_settings": {
            "stability": voice_cfg["stability"],
            "similarity_boost": voice_cfg["similarity_boost"],
            "style": voice_cfg["style"],
            "use_speaker_boost": True,
        },
    }

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_cfg['voice_id']}"
    try:
        response = requests.post(
            url,
            headers={
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": api_key,
            },
            json=payload,
            timeout=30,
        )
    except requests.RequestException as exc:  # pragma: no cover - network failures
        raise HTTPException(status_code=502, detail=f"Erro ao contatar ElevenLabs: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Falha ElevenLabs ({response.status_code}): {response.text[:200]}")

    return response.content
