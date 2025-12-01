# email_service.py
import os
import smtplib
from email.message import EmailMessage

# Variáveis do .env (já carregadas pelo main.py)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Minha App")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
FRONTEND_RESET_URL = os.getenv("FRONTEND_RESET_URL", "http://localhost:5173/reset-password")


def send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("SMTP_USER ou SMTP_PASSWORD não configurados. Verifique o arquivo .env")

    if not text_body:
        text_body = "Seu cliente não suporta HTML. Abra o e-mail em outro aplicativo."

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def _build_reset_email_html(reset_link: str) -> str:
    """HTML simples, porém adequado para a maioria dos clientes, com botão de call-to-action."""
    return f"""
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 520px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; font-family: Arial, sans-serif; color: #0f172a;">
  <tr>
    <td style="padding: 24px 24px 8px 24px; text-align: center;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 28px; background: linear-gradient(135deg,#3b82f6,#10b981); color: #ffffff; font-size: 28px; line-height: 56px; font-weight: 700;">🔐</div>
      <h1 style="margin: 16px 0 8px 0; font-size: 22px; color: #0f172a; font-weight: 700;">Recuperação de senha</h1>
      <p style="margin: 0; font-size: 14px; color: #475569;">Você solicitou redefinir sua senha. Clique no botão abaixo para continuar.</p>
    </td>
  </tr>
  <tr>
    <td style="padding: 16px 24px 8px 24px; text-align: center;">
      <a href="{reset_link}" style="display: inline-block; padding: 12px 18px; background: linear-gradient(135deg,#3b82f6,#10b981); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">Redefinir senha</a>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 24px 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
      Se o botão não funcionar, copie e cole o link abaixo no navegador:<br/>
      <a href="{reset_link}" style="color: #2563eb; word-break: break-all;">{reset_link}</a>
    </td>
  </tr>
  <tr>
    <td style="padding: 8px 24px 24px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
      Se você não solicitou essa alteração, ignore este e-mail.
    </td>
  </tr>
</table>
"""


def _default_reset_link(token: str) -> str:
    """Gera link de reset estilo /reset-password/<token> se apenas a base estiver configurada."""
    base = FRONTEND_RESET_URL.rstrip("/")
    if "{token}" in base:
        return base.replace("{token}", token)
    return f"{base}/{token}"


def send_password_reset_email(user_email: str, reset_link: str | None = None, token: str | None = None):
    subject = "Recuperação de senha"
    final_link = reset_link or (token and _default_reset_link(token))
    if not final_link:
        raise RuntimeError("Um reset_link ou token precisa ser informado para o e-mail de recuperação.")

    text_body = (
        "Você solicitou a redefinição de senha.\n"
        "Use o link abaixo (ou o botão, se disponível):\n"
        f"{final_link}\n\n"
        "Se você não solicitou, ignore este e-mail."
    )
    html_body = _build_reset_email_html(final_link)
    send_email(user_email, subject, html_body, text_body)
