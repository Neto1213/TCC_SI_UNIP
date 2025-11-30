export type NivelFoco = 'curto' | 'medio' | 'longo' | 'baixa' | 'media' | 'alta';

export interface BehavioralProfileIn {
  estilo_aprendizado: 'teorico' | 'pratico' | 'balanceado' | 'intensivo';
  tolerancia_dificuldade: 'baixa' | 'media' | 'alta';
  nivel_foco: NivelFoco;
  resiliencia_estudo: 'baixa' | 'media' | 'alta';
}

export interface StudyPlanIn {
  tema_estudo: string;
  conhecimento_tema: 'iniciante' | 'intermediario' | 'avancado';
  tempo_semanal: number;
  objetivo_estudo: 'prova' | 'projeto' | 'habito' | 'aprendizado_profundo';
}

export interface PredictPlanRequest {
  perfil: BehavioralProfileIn;
  plano: StudyPlanIn;
  semanas?: number;
  use_gpt?: boolean;
  model?: string;
  max_tokens?: number;
}

export type PedagogicType = 'fundamento' | 'pratica' | 'revisao' | 'aplicacao' | 'entrega' | string;

export interface StudyCard {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  order?: number;
  type?: PedagogicType;
  needs_review?: boolean;
  review_after_days?: number;
  effort_minutes?: number;
  stage_suggestion?: string;
  column_key: string;
  week?: number;
  depends_on: string[];
  raw: Record<string, any>;
  notes?: string;
}

export interface StudyPlanMeta {
  id: number;
  plan_title: string;
  learning_type: string;
  tema: string;
  perfil_label?: string | null;
  semanas: number;
  version?: number;
}

export interface PredictPlanResponse {
  classification?: {
    label: string;
    probability: number;
    alternatives: [string, number][];
    explanation: string[];
    feature_groups_importance: [string, number][];
  };
  skeleton?: any;
  semanas?: number;
  plan?: StudyPlanMeta;
  cards?: StudyCard[];
  stored?: boolean;
  plan_id?: number;
  plan_generation?: { error: string };
}

export interface PlanSummary {
  id: number;
  plan_title?: string | null;
  learning_type?: string;
  tema?: string | null;
  perfil_label?: string | null;
  semanas?: number | null;
  version?: number;
  created_at?: string | null;
}

export interface PlanDetail extends PlanSummary {
  raw_response?: any;
  cards: StudyCard[];
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name?: string | null;
  created_at?: string | null;
}

export type TtsProvider = 'piper' | 'elevenlabs';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

const TOKEN_KEY = 'auth_token';

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao validar sessão (${res.status}): ${text}`);
  }
  return res.json();
}

function authHeaders(extra?: Record<string, string>) {
  const token = getToken();
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) base['Authorization'] = `Bearer ${token}`;
  return { ...(base as any), ...(extra || {}) } as Record<string, string>;
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha no cadastro (${res.status}): ${text}`);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha no login (${res.status}): ${text}`);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao solicitar recuperação (${res.status}): ${text}`);
  }
  return res.json();
}

export async function validateResetToken(
  token: string
): Promise<{ valid: boolean; user_id?: number; email?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    return { valid: false };
  }
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao trocar a senha (${res.status}): ${text}`);
  }
  return res.json();
}

export async function predictPlan(payload: PredictPlanRequest, signal?: AbortSignal): Promise<PredictPlanResponse> {
  const res = await fetch(`${API_BASE}/api/v1/predict-plan`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro na API (${res.status}): ${text}`);
  }
  return res.json();
}

export async function listPlans(): Promise<PlanSummary[]> {
  const res = await fetch(`${API_BASE}/api/v1/plans`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao listar planos (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getPlan(planId: number): Promise<PlanDetail> {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao obter plano (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchTtsAudio(text: string, language?: string, provider?: TtsProvider): Promise<Blob> {
  const body: Record<string, any> = { text, language };
  if (provider) body.provider = provider;

  const res = await fetch(`${API_BASE}/api/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const textResp = await res.text();
    throw new Error(`Falha ao sintetizar fala (${res.status}): ${textResp}`);
  }
  return res.blob();
}

export async function updateCardNotes(
  planId: number,
  semana: number,
  cardId: string,
  notes: string
) {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}/card-notes`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ semana, card_id: cardId, notes }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao salvar anotacoes (${res.status}): ${text}`);
  }
  return res.json();
}

export async function updateCardStatus(
  planId: number,
  semana: number,
  cardId: string,
  status: string
) {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}/card-status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ semana, card_id: cardId, status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao atualizar status (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deletePlan(planId: number) {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao apagar plano (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deactivatePlan(planId: number) {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}/disable`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao desativar plano (${res.status}): ${text}`);
  }
  return res.json();
}
