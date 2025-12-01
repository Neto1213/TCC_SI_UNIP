# main.py
import os
import secrets
from datetime import datetime, timedelta
from typing import Dict

from dotenv import load_dotenv
load_dotenv()  # Carrega .env ANTES de importar email_service

from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.templating import Jinja2Templates

from email_service import send_password_reset_email

# Inicializa o FastAPI
app = FastAPI()

# Templates (HTML)
templates = Jinja2Templates(directory="templates")

# Config
FRONTEND_RESET_URL = os.getenv(
    "FRONTEND_RESET_URL",
    "http://127.0.0.1:8080/reset-password"
)

# Banco fake na memória (apenas para testes)
reset_tokens: Dict[str, Dict] = {}


# -------------------------------------
# ROTA: Tela inicial (login)
# -------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# -------------------------------------
# ROTA: solicitar link de reset de senha
# -------------------------------------
@app.post("/forgot-password", response_class=PlainTextResponse)
async def forgot_password(email: str = Form(...)):
    if not email:
        raise HTTPException(status_code=400, detail="E-mail é obrigatório")

    token = secrets.token_urlsafe(32)

    reset_tokens[token] = {
        "email": email,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "used": False,
    }

    reset_link = f"{FRONTEND_RESET_URL}?token={token}"
    send_password_reset_email(email, reset_link)

    return "Se o e-mail existir no sistema, enviaremos um link de recuperação."


# -------------------------------------
# ROTA: página para definir nova senha
# -------------------------------------
@app.get("/reset-senha", response_class=HTMLResponse)
async def reset_senha_get(request: Request, token: str | None = None):
    if not token or token not in reset_tokens:
        raise HTTPException(status_code=400, detail="Token inválido")

    data = reset_tokens[token]

    if data["used"] or data["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expirado ou já utilizado")

    html = f"""
        <h1>Definir nova senha</h1>
        <form method="post">
          <input type="hidden" name="token" value="{token}" />
          <label>Nova senha:</label><br />
          <input type="password" name="password" /><br /><br />
          <button type="submit">Salvar</button>
        </form>
    """

    return HTMLResponse(content=html)


# -------------------------------------
# ROTA: salvar nova senha
# -------------------------------------
@app.post("/reset-senha", response_class=PlainTextResponse)
async def reset_senha_post(token: str = Form(...), password: str = Form(...)):
    if token not in reset_tokens:
        raise HTTPException(status_code=400, detail="Token inválido")

    data = reset_tokens[token]

    if data["used"] or data["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expirado ou já utilizado")

    # Aqui você faria o hash da senha para salvar no banco
    print(f"[DEBUG] Trocar senha do usuário {data['email']} para: {password}")

    data["used"] = True
    return "Senha alterada com sucesso (mock)."


# -------------------------------------
# RODAR
# -------------------------------------
# Comando:
# uvicorn main:app --reload --port 8000
