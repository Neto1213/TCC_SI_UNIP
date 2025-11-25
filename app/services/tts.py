from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

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
