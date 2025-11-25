# gpt_api.py
import os
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Dict, Any, Tuple
from pathlib import Path

ARTIFACTS_DIR = Path("artifacts")

# ---------------- Helpers de rede e debug ----------------
def _build_session() -> requests.Session:
    retry = Retry(
        total=4,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST", "GET"]
    )
    s = requests.Session()
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s

def _parse_api_error(resp: requests.Response) -> Tuple[int, str, str]:
    status = resp.status_code
    try:
        j = resp.json()
        err = j.get("error", {})
        return status, err.get("message", resp.text), err.get("param", "")
    except Exception:
        return status, resp.text, ""

def _save_debug(filename: str, content: str) -> None:
    try:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        (ARTIFACTS_DIR / filename).write_text(content, encoding="utf-8")
    except Exception:
        pass

# --------------- FunÃ§Ã£o principal -----------------
def get_plan_from_gpt(
    skeleton: Dict[str, Any],
    semanas: int = 0,
    weekly_hours: float | int | None = None,
    model: str = "gpt-4o-mini",           # troque aqui se necessÃ¡rio (ex.: "gpt-4o-mini")
    max_tokens: int = 2000,         # valor inicial; pode aumentar automaticamente nos retries
    timeout_connect_sec: int = 10,
    timeout_read_sec: int = 180,
    max_auto_retries: int = 3       # quantas vezes aumentaremos o teto de tokens
) -> Dict[str, Any]:
    """
    Gera o plano via /v1/chat/completions com response_format=json_object.
    - Schema ajustado: 'tarefas' Ã© uma lista de OBJETOS {id,title,type,hours,description}.
    - Se vier 'content' vazio ou finish_reason='length', aumenta tokens e retenta.
    - Sem fallback local: sÃ³ retorna se a API devolver JSON vÃ¡lido.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Defina a variÃ¡vel de ambiente OPENAI_API_KEY com sua chave da API.")

    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # Regras de concisÃ£o para caber no orÃ§amento de tokens
    concisao = (
        "Se estiver perto do limite de tokens, priorize completar o JSON reduzindo conteÃºdo textual "
        "(cada string com atÃ© 120 caracteres), nunca deixe chaves sem fechar."
    )

    # === SCHEMA: tarefas como OBJETOS com id/title/type/hours/description ===
    schema_text = (
        "{"
        "\"tema\": str, \"perfil_label\": str, \"estilo\": str, \"nivel\": int, "
        "\"objetivo\": str, \"carga_horas_semana\": number, \"semanas\": int, "
        "\"plano\": [ { "
        "\"semana\": int, \"objetivo_semana\": str, "
        "\"topicos\": [str], "
        "\"tarefas\": [ { "
        "\"id\": str, \"title\": str, \"type\": str, \"hours\": str, \"description\": str "
        "} ], "
        "\"referencias\": [ {\"titulo\": str, \"url\": str} ] } ] "
        "}"
    )

    # Prompts diretos para JSON
    system_prompt = (
        "VocÃª retorna APENAS JSON vÃ¡lido (sem markdown). "
        "Siga o schema pedido com exatidÃ£o de chaves e tipos."
    )
    horas_semanal_texto = (
        f"A carga horÃ¡ria semanal informada Ã© {weekly_hours} horas."
        if weekly_hours is not None
        else "Use a carga horÃ¡ria semanal informada no esqueleto."
    )

    semanas_texto = (
        "Defina a quantidade de semanas que precisar (nÃ£o fixe em 4); inclua no campo 'semanas' do JSON um inteiro coerente com a carga horÃ¡ria total."
        if semanas == 0
        else f"Planeje em {semanas} semanas, mas ajuste se precisar de mais/menos para distribuir as horas."
    )

    user_prompt = (
        "Crie um plano de estudo seguindo EXATAMENTE este schema (chaves e tipos):\n"
        f"{schema_text}\n"
        "Cada tarefa DEVE seguir o padrÃ£o: "
        "{\"id\": \"task-1\", \"title\": \"Estudar conceitos basicos\", \"type\": \"teoria\", \"hours\": \"4h\", \"description\": \"Descricao: escreva 2-4 linhas objetivas sobre o que fazer, objetivo e resultado esperado.\\n\\nComo fazer: liste 3-5 itens curtos separados por virgulas (ex.: rever anotacoes, fazer 3 exercicios, validar respostas)\"}.\\n"
        "Importante: NAO repita o titulo dentro de 'description' e NAO inclua '#N' ou '(Titulo)' na 'description'. O cabecalho '#N (Titulo)' sera exibido pelo frontend.\\nFormato da 'description' exigido (com quebras de linha usando \\n): 'Descricao: ...' (2-4 linhas) + linha em branco + 'Como fazer: item1, item2, item3'.\\n"
        f"{concisao}\n"
        f"{horas_semanal_texto} {semanas_texto}\n"
        "- Regra 1: PARA CADA semana, distribua tarefas de forma que a soma das 'hours' das tarefas dessa semana seja EXATAMENTE igual Ã carga_horas_semana informada (sem faltar nem sobrar).\n"
        "- Regra 2: 'hours' pode ser decimal (ex.: '1.5h') ou formato hh:mm (ex.: '1:30'), aceite minutos. Varie duracoes entre ~45min e ~3h conforme a carga horÃ¡ria.\n"
        "- Regra 3: NAO limite a quantidade de tarefas por semana; gere quantas forem necessÃ¡rias para fechar a carga horÃ¡ria semanal.\n"
        "- Regra 4: gere quantas semanas forem necessÃ¡rias para cobrir o conteÃºdo; ajuste o campo 'semanas' e os blocos de 'semana' conforme a carga horÃ¡ria total (carga_horas_semana * semanas).\n"
        f"Use o esqueleto a seguir como contexto.\n"
        f"Esqueleto: {json.dumps(skeleton, ensure_ascii=False)}"
    )

    base_payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt}
        ]
    }

    session = _build_session()

    def _post_with_cap(cap_key: str, cap_value: int) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        payload = dict(base_payload)
        payload[cap_key] = cap_value
        r = session.post(url, headers=headers, json=payload, timeout=(timeout_connect_sec, timeout_read_sec))
        if r.status_code != 200:
            status, msg_err, _ = _parse_api_error(r)
            raise RuntimeError(f"Erro na API ({status}) id={r.headers.get('x-request-id','sem-id')}: {msg_err}")
        data = r.json()
        msg = data["choices"][0]["message"]
        finish_reason = data["choices"][0].get("finish_reason")
        content = (msg.get("content") or "").strip()
        return {"content": content, "finish_reason": finish_reason}, data

    # Detecta qual chave de token o modelo aceita
    def _try_with_key(key_name: str, start_cap: int) -> Dict[str, Any]:
        cap = start_cap
        attempts = 0
        while True:
            resp, raw = _post_with_cap(key_name, cap)
            content = resp["content"]
            finish_reason = resp["finish_reason"]

            if content:
                try:
                    return json.loads(content)
                except Exception:
                    _save_debug("last_openai_raw.txt", content)
                    if attempts < max_auto_retries:
                        attempts += 1
                        cap = int(start_cap * (2 if attempts == 1 else 3))
                        continue
                    raise RuntimeError("Conteudo retornado nao e JSON valido (ver artifacts/last_openai_raw.txt).")

            if finish_reason == "length" and attempts < max_auto_retries:
                attempts += 1
                cap = int(start_cap * (2 if attempts == 1 else 3))  # 2000->4000->6000
                continue

            _save_debug("last_openai_response.json", json.dumps(raw, ensure_ascii=False, indent=2))
            raise RuntimeError("Resposta 200 porem 'content' vazio (ver artifacts/last_openai_response.json).")
    try:
        return _try_with_key("max_completion_tokens", max_tokens)
    except RuntimeError as e:
        if "max_completion_tokens" in str(e) or "Unsupported parameter" in str(e):
            pass  # alguns modelos nÃ£o aceitam essa chave; caÃ­mos no fallback
        else:
            # mesmo que nÃ£o seja esse o erro, tentaremos com max_tokens por robustez
            pass

    # 2) fallback: tentar com max_tokens
    return _try_with_key("max_tokens", max_tokens)
