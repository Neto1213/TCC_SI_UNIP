# core_algo.py
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from joblib import dump, load

np.random.seed(42)

# -----------------------
# Constantes e dicionários (em português)
# -----------------------
ESTILOS = {'1': 'teorico', '2': 'pratico', '3': 'balanceado', '4': 'intensivo'}
NIVEIS = {'1': 'baixa', '2': 'media', '3': 'alta'}
CONHECIMENTO = {'1': 'iniciante', '2': 'intermediario', '3': 'avancado'}
OBJETIVOS = {'1': 'prova', '2': 'projeto', '3': 'habito', '4': 'aprendizado_profundo'}

# -----------------------
# Mapeamento regra-based para gerar label sintético
# -----------------------
def map_to_label(row):
    estilo = row['estilo_aprendizado']
    tempo = int(row['tempo_semanal'])
    tol = row['tolerancia_dificuldade']
    foco = row['nivel_foco']
    res = row['resiliencia_estudo']
    conhecimento = row['conhecimento_tema']

    if estilo == 'teorico':
        base = 'T'
    elif estilo == 'pratico':
        base = 'P'
    elif estilo == 'balanceado':
        base = 'B'
    else:
        base = 'I'

    if tempo <= 7:
        nivel = 1
    elif tempo <= 14:
        nivel = 2
    else:
        nivel = 3

    adj = 0
    for valor in [tol, foco, res, conhecimento]:
        if valor in ('alta', 'avancado'):
            adj += 1
        elif valor in ('baixa', 'iniciante'):
            adj -= 1

    nivel2 = max(1, min(3, nivel + adj))
    return f"{base}{nivel2}"

# -----------------------
# Gerador sintético
# -----------------------
def generate_synthetic(n=500):
    rows = []
    for _ in range(n):
        row = {
            'estilo_aprendizado': np.random.choice(list(ESTILOS.values()), p=[0.25, 0.35, 0.25, 0.15]),
            'tolerancia_dificuldade': np.random.choice(list(NIVEIS.values()), p=[0.2, 0.6, 0.2]),
            'nivel_foco': np.random.choice(list(NIVEIS.values()), p=[0.3, 0.5, 0.2]),
            'resiliencia_estudo': np.random.choice(list(NIVEIS.values()), p=[0.3, 0.5, 0.2]),
            'conhecimento_tema': np.random.choice(list(CONHECIMENTO.values()), p=[0.5, 0.35, 0.15]),
            'tempo_semanal': int(np.clip(np.random.exponential(scale=5) + 1, 1, 40)),
            'objetivo_estudo': np.random.choice(list(OBJETIVOS.values()), p=[0.35, 0.25, 0.25, 0.15]),
            'texto_livre': ""
        }
        row['label'] = map_to_label(row)
        rows.append(row)
    return pd.DataFrame(rows)

# -----------------------
# OneHotEncoder compatível (sklearn ≥1.4 usa sparse_output)
# -----------------------
def _ohe_dense():
    try:
        return OneHotEncoder(handle_unknown='ignore', sparse_output=False)  # sklearn 1.4+
    except TypeError:
        return OneHotEncoder(handle_unknown='ignore', sparse=False)         # sklearn ≤1.3

# -----------------------
# Pipeline: pré-processamento + classificador
# -----------------------
_CAT_FEATS = [
    'estilo_aprendizado', 'tolerancia_dificuldade', 'nivel_foco',
    'resiliencia_estudo', 'conhecimento_tema', 'objetivo_estudo'
]
_NUM_FEATS = ['tempo_semanal']

def _build_pipeline(max_depth=6, random_state=42) -> Pipeline:
    prep = ColumnTransformer(
        transformers=[
            ("cat", _ohe_dense(), _CAT_FEATS),
            ("num", "passthrough", _NUM_FEATS),
        ],
        remainder='drop',
        verbose_feature_names_out=True
    )
    clf = DecisionTreeClassifier(criterion='gini', max_depth=max_depth, random_state=random_state)
    pipe = Pipeline(steps=[("prep", prep), ("clf", clf)])
    return pipe

def _get_feature_names(pipe: Pipeline):
    prep = pipe.named_steps['prep']
    try:
        names = list(prep.get_feature_names_out())
    except Exception:
        cat = prep.named_transformers_['cat']
        cat_names = cat.get_feature_names_out(_CAT_FEATS)
        names = [f"cat__{n}" for n in cat_names] + [f"num__{c}" for c in _NUM_FEATS]
    return names

# -----------------------
# Treinamento + avaliação
# -----------------------
def train_model(df: pd.DataFrame, max_depth=6, random_state=42) -> Dict[str, Any]:
    X = df[_CAT_FEATS + _NUM_FEATS]
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=random_state)

    pipe = _build_pipeline(max_depth=max_depth, random_state=random_state)
    pipe.fit(X_train, y_train)

    preds = pipe.predict(X_test)
    report = classification_report(y_test, preds)

    feature_names = _get_feature_names(pipe)

    return {
        'clf': pipe,
        'X_columns': feature_names,
        'label_encoder': None,
        'report': report,
        'X_example': X,
        'cat_feats': _CAT_FEATS,
        'num_feats': _NUM_FEATS,
    }

# -----------------------
# Importâncias por grupo (coluna original)
# -----------------------
def group_feature_importances(pipe: Pipeline, feature_names, cat_feats, num_feats):
    importances = pipe.named_steps['clf'].feature_importances_
    groups = {c: 0.0 for c in (cat_feats + num_feats)}

    for fname, imp in zip(feature_names, importances):
        if '__' in fname:
            after = fname.split('__', 1)[1]
        else:
            after = fname
        base = next((col for col in (cat_feats + num_feats) if after.startswith(col)), after)
        groups[base] = groups.get(base, 0.0) + float(imp)
    return groups

# -----------------------
# Predição + explicação (usando o Pipeline)
# -----------------------
def predict_with_explanation(model_objs, input_dict, top_k=3):
    pipe: Pipeline = model_objs['clf']
    feature_names = model_objs['X_columns']
    cat_feats = model_objs['cat_feats']
    num_feats = model_objs['num_feats']

    df_u = pd.DataFrame([input_dict])
    proba = pipe.predict_proba(df_u)[0]
    classes = pipe.named_steps['clf'].classes_

    idx_sorted = np.argsort(proba)[::-1]
    top_idx = idx_sorted[:top_k]
    top_classes = [(classes[i], float(proba[i])) for i in top_idx]

    explicacao = [
        f"Estilo de Aprendizado: {input_dict['estilo_aprendizado']}",
        f"Tempo semanal: {input_dict['tempo_semanal']}h",
        f"Tolerância a desafios: {input_dict['tolerancia_dificuldade']}",
        f"Foco/Disciplina: {input_dict['nivel_foco']}",
        f"Resiliência: {input_dict['resiliencia_estudo']}",
        f"Nível de conhecimento: {input_dict['conhecimento_tema']}",
        f"Objetivo do estudo: {input_dict['objetivo_estudo']}",
    ]

    groups = group_feature_importances(pipe, feature_names, cat_feats, num_feats)
    ranking_groups = sorted(groups.items(), key=lambda x: x[1], reverse=True)

    return {
        'principal': top_classes[0],
        'alternativas': top_classes[1:],
        'explicacao': explicacao,
        'ranking_groups': ranking_groups,
    }

# -----------------------
# Gerador de esqueleto de plano (igual ao seu)
# -----------------------
def generate_plan_skeleton(label, objetivo, tema):
    estilo = label[0]  # T, P, B, I
    nivel = int(label[1])

    nivel_map = {
        1: {'duracao_semanal_horas': 3, 'blocos_semanais': 2},
        2: {'duracao_semanal_horas': 7, 'blocos_semanais': 4},
        3: {'duracao_semanal_horas': 14, 'blocos_semanais': 7},
    }

    base = nivel_map.get(nivel, nivel_map[2])

    if estilo == 'T':
        estrutura = [
            {'tipo': 'leitura', 'descricao': 'Fundamentos e teoria', 'duracao_h': base['duracao_semanal_horas'] * 0.9},
            {'tipo': 'resumo', 'descricao': 'Mapeamento e resumos', 'duracao_h': base['duracao_semanal_horas'] * 0.1}
        ]
    elif estilo == 'P':
        estrutura = [
            {'tipo': 'pratica', 'descricao': 'Exercícios e projetos', 'duracao_h': base['duracao_semanal_horas'] * 0.9},
            {'tipo': 'leitura', 'descricao': 'Referência rápida', 'duracao_h': base['duracao_semanal_horas'] * 0.1}
        ]
    elif estilo == 'B':
        estrutura = [
            {'tipo': 'leitura', 'descricao': 'Conceitos chave', 'duracao_h': base['duracao_semanal_horas'] * 0.5},
            {'tipo': 'pratica', 'descricao': 'Aplicações práticas', 'duracao_h': base['duracao_semanal_horas'] * 0.5}
        ]
    else:
        estrutura = [
            {'tipo': 'blocos_diarios', 'descricao': 'Blocos curtos com revisão ativa', 'duracao_h': base['duracao_semanal_horas']}
        ]

    if objetivo == 'prova':
        estrutura.append({'tipo': 'simulados', 'descricao': 'Questões e revisões focadas', 'duracao_h': base['duracao_semanal_horas'] * 0.2})
    elif objetivo == 'projeto':
        estrutura.append({'tipo': 'entregavel', 'descricao': 'Tarefas práticas com entregáveis', 'duracao_h': base['duracao_semanal_horas'] * 0.4})
    elif objetivo == 'habito':
        estrutura.append({'tipo': 'consistencia', 'descricao': 'Micro-hábitos diários', 'duracao_h': base['duracao_semanal_horas'] * 0.15})
    else:
        estrutura.append({'tipo': 'imersao', 'descricao': 'Estudos dirigidos e exploração', 'duracao_h': base['duracao_semanal_horas'] * 0.4})

    plan = {
        'tema': tema,
        'label': label,
        'estilo': estilo,
        'nivel': nivel,
        'objetivo': objetivo,
        'duracao_semanal_horas': base['duracao_semanal_horas'],
        'estrutura': estrutura,
    }
    return plan

# -----------------------
# Persistência (salvar/carregar .joblib)
# -----------------------
def save_model(model_objs: Dict[str, Any], path: str = "models/studyplan_pipeline.joblib") -> str:
    """
    Salva pipeline + metadados. Cria a pasta automaticamente.
    """
    pacote = {
        "pipe": model_objs['clf'],
        "feature_names": model_objs['X_columns'],
        "cat_feats": model_objs['cat_feats'],
        "num_feats": model_objs['num_feats'],
        "report": model_objs['report'],
    }
    out = Path(path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    dump(pacote, out, compress=3, protocol=5)
    return str(out)

def load_model(path: str = "models/studyplan_pipeline.joblib") -> Dict[str, Any]:
    pacote = load(path)
    return {
        'clf': pacote['pipe'],
        'X_columns': pacote['feature_names'],
        'label_encoder': None,
        'report': pacote.get('report', ''),
        'X_example': None,
        'cat_feats': pacote['cat_feats'],
        'num_feats': pacote['num_feats'],
    }
