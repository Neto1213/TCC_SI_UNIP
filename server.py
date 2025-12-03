import os
from pathlib import Path
from typing import Any, Dict, Optional, List
import asyncio
from contextlib import asynccontextmanager
from dataclasses import asdict

import jwt
from fastapi import FastAPI, HTTPException, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core_algo import (
    ESTILOS,
    NIVEIS,
    CONHECIMENTO,
    OBJETIVOS,
    generate_synthetic,
    train_model,
    predict_with_explanation,
    generate_plan_skeleton,
    save_model,
    load_model,
)
from gpt_api import get_plan_from_gpt
from io_json import save_plan_to_json

# DB & Auth
from app.db import engine
from app.models.base import Base
import app.models.user  # noqa: F401
import app.models.plan  # noqa: F401
import app.models.card  # noqa: F401
from app.db_migrations import run_sql_migrations
from app.deps import get_db, get_current_user, get_current_user_optional
from app.schemas.user import (
    UserCreate,
    UserLogin,
    UserOut,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetTokenValidationResponse,
)
from app.schemas.plan import (
    PlanCreate,
    PlanOut,
    PlanDetail,
    StudyPlanMeta,
    StudyCard,
    StudyPlanResponse,
)
from app.crud.user import (
    create_user as crud_create_user,
    authenticate_user,
    get_user_by_email,
    update_user_password,
    get_user,
)
from app.crud.plan import (
    create_plan as crud_create_plan,
    create_plan_with_cards,
    list_user_plans,
    get_user_plan,
    list_cards,
    get_plan_card_by_identifier,
)
from app.security import (
    create_access_token,
    create_reset_password_token,
    decode_reset_password_token,
)
from app.services.plan_transformer import transform_ai_plan
from app.services.tts import synthesize_with_piper, synthesize_with_elevenlabs, is_elevenlabs_configured
from SMTP.email_service import send_password_reset_email


MODEL_PATH = "models/studyplan_pipeline.joblib"
ARTIFACT_PLAN_PATH = "artifacts/plano_estudos.json"
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
# Pode apontar para a rota base de reset (ex.: https://meusite.com/reset-password) ou incluir {token} para interpolar.
RESET_PASSWORD_URL = os.getenv("FRONTEND_RESET_URL", f"{FRONTEND_BASE_URL.rstrip('/')}/reset-password")
FORGOT_PASSWORD_GENERIC_MSG = "Se este e-mail estiver cadastrado, enviaremos um link de recuperação."


class BehavioralProfileIn(BaseModel):
    estilo_aprendizado: str
    tolerancia_dificuldade: str
    nivel_foco: str  # accepts 'baixa'|'media'|'alta' or 'curto'|'medio'|'longo' (mapped below)
    resiliencia_estudo: str


class StudyPlanIn(BaseModel):
    tema_estudo: str
    conhecimento_tema: str
    tempo_semanal: int = Field(ge=1, le=168)
    objetivo_estudo: str


class PredictPlanRequest(BaseModel):
    perfil: BehavioralProfileIn
    plano: StudyPlanIn
    semanas: int = Field(default=4, ge=1, le=52)
    use_gpt: bool = True
    model: Optional[str] = None  # e.g. "gpt-4o-mini"
    max_tokens: Optional[int] = None


def _normalize_foco(value: str) -> str:
    foco_map = {
        "curto": "baixa",
        "medio": "media",
        "médio": "media",
        "longo": "alta",
    }
    v = value.strip().lower()
    return foco_map.get(v, v)


def _validate_enums(perfil: BehavioralProfileIn, plano: StudyPlanIn) -> None:
    if perfil.estilo_aprendizado not in ESTILOS.values():
        raise HTTPException(status_code=422, detail=f"estilo_aprendizado inválido: {perfil.estilo_aprendizado}")
    if perfil.tolerancia_dificuldade not in NIVEIS.values():
        raise HTTPException(status_code=422, detail=f"tolerancia_dificuldade inválido: {perfil.tolerancia_dificuldade}")
    if perfil.resiliencia_estudo not in NIVEIS.values():
        raise HTTPException(status_code=422, detail=f"resiliencia_estudo inválido: {perfil.resiliencia_estudo}")
    if plano.conhecimento_tema not in CONHECIMENTO.values():
        raise HTTPException(status_code=422, detail=f"conhecimento_tema inválido: {plano.conhecimento_tema}")
    if plano.objetivo_estudo not in OBJETIVOS.values():
        raise HTTPException(status_code=422, detail=f"objetivo_estudo inválido: {plano.objetivo_estudo}")


def _ensure_model() -> Dict[str, Any]:
    if Path(MODEL_PATH).exists():
        return load_model(MODEL_PATH)
    df = generate_synthetic(2000)
    model_objs = train_model(df, max_depth=6)
    save_model(model_objs, MODEL_PATH)
    return model_objs


def _ensure_task_status(plan_json: Dict[str, Any]) -> Dict[str, Any]:
    """Garante que cada tarefa possua o campo 'status'."""
    for semana in plan_json.get("plano", []):
        tarefas = semana.get("tarefas", [])
        if not isinstance(tarefas, list):
            continue
        for tarefa in tarefas:
            if isinstance(tarefa, dict):
                tarefa.setdefault("status", "novo")
    return plan_json


def _to_study_card_schema(card_dict: Dict[str, Any]) -> StudyCard:
    return StudyCard(
        id=card_dict.get("id", ""),
        title=card_dict.get("title", "Tarefa"),
        description=card_dict.get("description"),
        instructions=card_dict.get("instructions"),
        order=card_dict.get("order"),
        type=card_dict.get("type"),
        needs_review=bool(card_dict.get("needs_review", False)),
        review_after_days=card_dict.get("review_after_days"),
        effort_minutes=card_dict.get("effort_minutes"),
        stage_suggestion=card_dict.get("stage_suggestion"),
        column_key=card_dict.get("column_key", "novo"),
        week=card_dict.get("week"),
        depends_on=card_dict.get("depends_on") or [],
        raw=card_dict.get("raw") or {},
        notes=card_dict.get("notes"),
    )


def _card_model_to_schema(card) -> StudyCard:
    return StudyCard(
        id=card.source_id or str(card.id),
        title=card.title,
        description=card.description,
        instructions=card.instructions,
        order=card.order,
        type=card.type,
        needs_review=card.needs_review,
        review_after_days=card.review_after_days,
        effort_minutes=card.effort_minutes,
        stage_suggestion=card.stage_suggestion,
        column_key=card.column_key,
        week=card.week,
        depends_on=card.depends_on or [],
        raw=card.raw or {},
        notes=card.notes,
    )


def _build_reset_link(token: str) -> str:
    """Monta o link de reset apontando para o front configurado."""
    base = (RESET_PASSWORD_URL or f"{FRONTEND_BASE_URL.rstrip('/')}/reset-password").rstrip("/")

    # Se o usuário configurar um placeholder explícito no .env, usamos diretamente.
    if "{token}" in base:
        return base.replace("{token}", token)

    # Se a URL já vier com query string, anexamos como param (?token=... / &token=...)
    if "?" in base:
        sep = "&" if base.count("?") == 1 and not base.endswith("?") else ""
        return f"{base}{sep}token={token}"

    # Padrão: usa segmento de path, resultando em /reset-password/<token>
    return f"{base}/{token}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Garante setup de banco/modelo e evita estouro de stack ao encerrar com CTRL+C,
    absorvendo o CancelledError emitido pelo Uvicorn durante o shutdown.
    """
    try:
        Base.metadata.create_all(bind=engine)
        run_sql_migrations(engine)
        app.state.model_objs = _ensure_model()
        yield
    except asyncio.CancelledError:
        return  # shutdown solicitado (ctrl+c / reload)


app = FastAPI(title="Projeto_IA API", version="1.0.0", lifespan=lifespan)

# CORS - libera para frontends típicos em dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2[0-9]|3[0-1])(?:\.\d{1,3}){2})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/enums")
def enums() -> Dict[str, Any]:
    return {
        "estilos": list(ESTILOS.values()),
        "niveis": list(NIVEIS.values()),
        "conhecimento": list(CONHECIMENTO.values()),
        "objetivos": list(OBJETIVOS.values()),
        "nivel_foco_alias": {"curto": "baixa", "medio": "media", "longo": "alta"},
    }


@app.post("/api/v1/predict-plan")
def predict_plan(
    payload: PredictPlanRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
) -> JSONResponse:
    perfil = payload.perfil
    plano = payload.plano

    perfil_norm = BehavioralProfileIn(
        estilo_aprendizado=perfil.estilo_aprendizado,
        tolerancia_dificuldade=perfil.tolerancia_dificuldade,
        nivel_foco=_normalize_foco(perfil.nivel_foco),
        resiliencia_estudo=perfil.resiliencia_estudo,
    )

    _validate_enums(perfil_norm, plano)

    input_dict = {
        "estilo_aprendizado": perfil_norm.estilo_aprendizado,
        "tolerancia_dificuldade": perfil_norm.tolerancia_dificuldade,
        "nivel_foco": perfil_norm.nivel_foco,
        "resiliencia_estudo": perfil_norm.resiliencia_estudo,
        "conhecimento_tema": plano.conhecimento_tema,
        "tempo_semanal": plano.tempo_semanal,
        "objetivo_estudo": plano.objetivo_estudo,
        "texto_livre": plano.tema_estudo,
    }

    model_objs = getattr(app.state, "model_objs", None)
    if model_objs is None:
        model_objs = _ensure_model()
        app.state.model_objs = model_objs

    pred = predict_with_explanation(model_objs, input_dict, top_k=3)
    principal_label, principal_proba = pred["principal"]

    skeleton = generate_plan_skeleton(
        principal_label, input_dict["objetivo_estudo"], input_dict["texto_livre"]
    )

    response: Dict[str, Any] = {
        "classification": {
            "label": principal_label,
            "probability": principal_proba,
            "alternatives": pred.get("alternativas", []),
            "explanation": pred.get("explicacao", []),
            "feature_groups_importance": pred.get("ranking_groups", []),
        },
        "skeleton": skeleton,
        "semanas": payload.semanas,
    }

    if payload.use_gpt:
        try:
            plan_json = get_plan_from_gpt(
                skeleton=skeleton,
                semanas=payload.semanas or 0,
                weekly_hours=plano.tempo_semanal,
                model=payload.model or "gpt-4o-mini",
                max_tokens=payload.max_tokens or 1200,
            )
            plan_json = _ensure_task_status(plan_json)
            transformed = transform_ai_plan(plan_json)

            stored = False
            plan_meta = StudyPlanMeta(
                id=0,
                plan_title=transformed.plan_title,
                learning_type=transformed.learning_type,
                tema=transformed.tema,
                perfil_label=transformed.perfil_label,
                semanas=transformed.semanas,
                version=2,
            )
            cards_payload = [asdict(c) for c in transformed.cards]
            cards_schema: List[StudyCard]

            if current_user is not None:
                plan_db, card_models = create_plan_with_cards(
                    db,
                    user_id=current_user.id,
                    plan_title=transformed.plan_title,
                    learning_type=transformed.learning_type,
                    tema=transformed.tema,
                    perfil_label=transformed.perfil_label,
                    semanas=transformed.semanas,
                    version=2,
                    raw_response=transformed.raw,
                    cards_payload=cards_payload,
                )
                plan_meta.id = plan_db.id
                stored = True
                cards_schema = [
                    StudyCard(
                        id=card.source_id or str(card.id),
                        title=card.title,
                        description=card.description,
                        instructions=card.instructions,
                        order=card.order,
                        type=card.type,
                        needs_review=card.needs_review,
                        review_after_days=card.review_after_days,
                        effort_minutes=card.effort_minutes,
                        stage_suggestion=card.stage_suggestion,
                        column_key=card.column_key,
                        week=card.week,
                        depends_on=card.depends_on or [],
                        raw=card.raw or {},
                        notes=card.notes,
                    )
                    for card in card_models
                ]
            else:
                cards_schema = [
                    _to_study_card_schema(card_dict) for card_dict in cards_payload
                ]

            response["plan"] = plan_meta.model_dump()
            response["cards"] = [card.model_dump() for card in cards_schema]
            response["stored"] = stored
            if stored:
                response["plan_id"] = plan_meta.id
        except Exception as e:
            response["plan_generation"] = {"error": str(e)}

    return JSONResponse(response)


def _plan_to_cards(plan_json: Dict[str, Any]) -> Dict[str, Any]:
    """Converte o plano em estrutura de cartões por semana."""
    plan_json = _ensure_task_status(plan_json)
    out = []
    for semana in plan_json.get("plano", []):
        semana_num = semana.get("semana")
        objetivo_semana = semana.get("objetivo_semana", "")
        tasks = semana.get("tarefas", [])
        cards = []
        for t in tasks:
            # suporta tanto lista de strings quanto objetos bem formatados
            if isinstance(t, dict):
                # limpa cabeçalho duplicado vindo do LLM (ex.: "#1 (Título)") na primeira linha
                raw_desc = (t.get("description") or "").strip()
                desc_lines = [ln.strip() for ln in raw_desc.splitlines()]
                if desc_lines and desc_lines[0].startswith("#"):
                    desc_lines = desc_lines[1:]
                cleaned_desc = "\n".join([ln for ln in desc_lines if ln != ""]).strip()

                card = {
                    "id": t.get("id", ""),
                    "title": t.get("title", ""),
                    "type": t.get("type", ""),
                    "hours": t.get("hours", ""),
                    "description": cleaned_desc,
                    "notes": t.get("notes", ""),
                    "status": t.get("status", "novo"),
                }
            else:
                # fallback: transforma string em descrição única
                card = {
                    "id": f"task-{len(cards)+1}",
                    "title": "Tarefa",
                    "type": "teoria",
                    "hours": "",
                    "description": str(t),
                    "notes": "",
                    "status": "novo",
                }
            cards.append(card)
        out.append({
            "semana": semana_num,
            "objetivo_semana": objetivo_semana,
            "cards": cards,
        })
    return {"tema": plan_json.get("tema", ""), "semanas": out}


class PlanJSONIn(BaseModel):
    plan: Dict[str, Any]


@app.post("/api/v1/plan/cards")
def plan_cards(body: PlanJSONIn) -> Dict[str, Any]:
    return _plan_to_cards(body.plan)


# ---------- Auth ----------
# Fluxo de reset de senha: geração, validação e troca de senha via token curto de e-mail.
@app.post("/api/v1/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, body.email)
    if not user:
        return {"message": FORGOT_PASSWORD_GENERIC_MSG}

    token = create_reset_password_token(user_id=user.id, email=user.email)
    reset_link = _build_reset_link(token)
    try:
        send_password_reset_email(user.email, reset_link)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Não foi possível enviar o e-mail de recuperação") from exc

    return {"message": FORGOT_PASSWORD_GENERIC_MSG}


@app.get("/api/v1/auth/validate-reset-token", response_model=ResetTokenValidationResponse)
def validate_reset_token(token: str):
    try:
        payload = decode_reset_password_token(token)
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"valid": False})
    except jwt.PyJWTError:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"valid": False})

    return ResetTokenValidationResponse(valid=True, user_id=int(payload.get("sub")), email=payload.get("email"))


@app.post("/api/v1/auth/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_reset_password_token(body.token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido")

    user_id = int(payload.get("sub"))
    email = payload.get("email")
    user = get_user(db, user_id)
    if not user or user.email != email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido")

    update_user_password(db, user, body.new_password)
    return {"message": "Senha alterada com sucesso"}


@app.post("/api/v1/auth/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = authenticate_user(db, email=user_in.email, password=user_in.password)
    # acima retorna None se não existe ou senha errada; mas precisamos checar existência direta
    if get_user_by_email(db, user_in.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já registrado")
    user = crud_create_user(db, email=user_in.email, password=user_in.password, name=user_in.name)
    token = create_access_token(user_id=user.id)
    return Token(access_token=token)


@app.post("/api/v1/auth/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, email=user_in.email, password=user_in.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    token = create_access_token(user_id=user.id)
    return Token(access_token=token)


@app.get("/api/v1/auth/me", response_model=UserOut)
def auth_me(current_user=Depends(get_current_user)):
    """
    Retorna os dados do usuário autenticado usando o token JWT atual.
    Incluímos um campo 'name' derivado do e-mail quando não houver nome explícito.
    """
    derived_name = (
        current_user.username
        or (current_user.email.split("@")[0].title() if current_user.email else None)
    )
    return UserOut.model_validate(
        {
            "id": current_user.id,
            "email": current_user.email,
            "name": derived_name,
            "created_at": current_user.created_at,
        }
    )


# ---------- Plans CRUD ----------
@app.get("/api/v1/plans", response_model=List[PlanOut])
def list_plans(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    plans = list_user_plans(db, user_id=current_user.id) or []
    for plan in plans:
        if plan.data is None and plan.raw_response:
            plan.data = plan.raw_response
    return plans


@app.get("/api/v1/plans/{plan_id}", response_model=PlanDetail)
def get_plan(plan_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    plan = get_user_plan(db, user_id=current_user.id, plan_id=plan_id, include_cards=True)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    cards_schema = [_card_model_to_schema(card) for card in plan.cards]
    if not cards_schema and plan.data:
        legacy_cards: List[StudyCard] = []
        legacy = _plan_to_cards(plan.data)
        for semana in legacy.get("semanas", []):
            for card in semana.get("cards", []):
                legacy_cards.append(
                    StudyCard(
                        id=card.get("id", ""),
                        title=card.get("title", "Tarefa"),
                        description=card.get("description"),
                        instructions=card.get("description"),
                        order=None,
                        type=card.get("type"),
                        needs_review=False,
                        column_key=card.get("status", "novo"),
                        week=semana.get("semana"),
                        depends_on=[],
                        raw=card,
                        notes=card.get("notes"),
                    )
                )
        cards_schema = legacy_cards
    detail = PlanDetail(
        id=plan.id,
        plan_title=plan.plan_title,
        learning_type=plan.learning_type,
        tema=plan.tema,
        perfil_label=plan.perfil_label,
        semanas=plan.semanas,
        version=plan.version,
        created_at=plan.created_at,
        data=plan.data,
        raw_response=plan.raw_response,
        cards=cards_schema,
    )
    return detail


@app.post("/api/v1/plans", response_model=PlanOut)
def create_plan(body: PlanCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    tema = body.tema
    if not tema:
        tema = body.data.get("tema") if isinstance(body.data, dict) else None
    data_payload = _ensure_task_status(dict(body.data or {}))
    plan = crud_create_plan(
        db,
        user_id=current_user.id,
        tema=tema,
        semanas=body.semanas,
        data=data_payload,
        plan_title=tema,
        learning_type="default",
        perfil_label=data_payload.get("perfil_label") if isinstance(data_payload, dict) else None,
        version=2,
    )
    return plan



# ---------- Card notes ----------
class CardNotesIn(BaseModel):
    semana: int
    card_id: str
    notes: str


@app.patch("/api/v1/plans/{plan_id}/card-notes")
def update_card_notes(
    plan_id: int,
    body: CardNotesIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    plan = get_user_plan(db, user_id=current_user.id, plan_id=plan_id, include_cards=True)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    card = get_plan_card_by_identifier(db, plan_id=plan.id, card_identifier=body.card_id)
    if card:
        card.notes = body.notes
        db.add(card)
        db.commit()
        db.refresh(card)
        return {"ok": True, "plan_id": plan.id, "card_id": card.source_id or str(card.id)}

    # Fallback legado
    data = _ensure_task_status(dict(plan.data or {}))
    plano = data.get("plano", [])
    found = False
    for semana in plano:
        if int(semana.get("semana", -1)) != int(body.semana):
            continue
        tarefas = semana.get("tarefas", [])
        for t in tarefas:
            if isinstance(t, dict) and t.get("id") == body.card_id:
                t["notes"] = body.notes
                found = True
                break
        if found:
            break

    if not found:
        raise HTTPException(status_code=404, detail="Card não encontrado para esta semana")

    plan.data = data
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"ok": True, "plan_id": plan.id}


class CardStatusIn(BaseModel):
    semana: int
    card_id: str
    status: str


@app.patch("/api/v1/plans/{plan_id}/card-status")
def update_card_status(
    plan_id: int,
    body: CardStatusIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    status_value = (body.status or "").strip().lower()
    if not status_value:
        raise HTTPException(status_code=422, detail="status inválido.")

    plan = get_user_plan(db, user_id=current_user.id, plan_id=plan_id, include_cards=True)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")

    card = get_plan_card_by_identifier(db, plan_id=plan.id, card_identifier=body.card_id)
    if card:
        card.column_key = status_value
        db.add(card)
        db.commit()
        db.refresh(card)
        return {"ok": True, "plan_id": plan.id, "card_id": card.source_id or str(card.id)}

    data = _ensure_task_status(dict(plan.data or {}))
    plano = data.get("plano", [])
    found = False
    for semana in plano:
        if int(semana.get("semana", -1)) != int(body.semana):
            continue
        tarefas = semana.get("tarefas", [])
        for t in tarefas:
            if isinstance(t, dict) and t.get("id") == body.card_id:
                t["status"] = status_value
                found = True
                break
        if found:
            break

    if not found:
        raise HTTPException(status_code=404, detail="Card não encontrado para esta semana")

    plan.data = data
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"ok": True, "plan_id": plan.id}
_FRONTEND_DIST = Path("adapte-estuda-planejador-main/dist").resolve()
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="static")

    @app.get("/")
    def _index() -> FileResponse:
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = None
    provider: Optional[str] = Field(
        default=None,
        description="Prefered provider. Defaults to ElevenLabs when configured, otherwise Piper.",
        pattern="^(piper|elevenlabs)$",
    )

@app.post("/api/v1/tts")
def generate_tts(body: TTSRequest) -> Response:
    """
    Endpoint simples que expõe o mecanismo TTS.
    Tenta ElevenLabs (se configurado via env) antes de recorrer ao Piper local.
    """
    preferred = (body.provider or "").lower()
    # First try ElevenLabs if configured or explicitly requested, otherwise fall back to Piper
    if preferred != "piper" and is_elevenlabs_configured():
        try:
            audio_bytes = synthesize_with_elevenlabs(body.text, body.language)
            headers = {
                "Cache-Control": "no-store",
                "Content-Disposition": "inline; filename=tts.mp3",
                "X-TTS-Provider": "elevenlabs",
            }
            return Response(content=audio_bytes, media_type="audio/mpeg", headers=headers)
        except HTTPException:
            # Fall back to Piper if ElevenLabs fails
            pass

    audio_bytes = synthesize_with_piper(body.text, body.language)
    headers = {
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=tts.wav",
        "X-TTS-Provider": "piper",
    }
    return Response(content=audio_bytes, media_type="audio/wav", headers=headers)
