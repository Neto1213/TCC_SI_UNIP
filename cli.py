# cli.py
from pathlib import Path
import json

from core_algo import (
    ESTILOS, NIVEIS, CONHECIMENTO, OBJETIVOS,
    generate_synthetic, train_model, predict_with_explanation,
    generate_plan_skeleton, save_model, load_model
)
from gpt_api import get_plan_from_gpt
from io_json import save_plan_to_json

MODEL_PATH = "models/studyplan_pipeline.joblib"
PLAN_PATH  = "artifacts/plano_estudos.json"

def _print_cards(plan_json: dict):
    """
    Imprime as tarefas já no padrão de card:
      { "id": "...", "title": "...", "type": "...", "hours": "4h", "description": "..." }
    Agrupadas por semana.
    """
    print("\n=== Tarefas em formato de CARD ===")
    for semana in plan_json.get("plano", []):
        print(f"\n--- Semana {semana.get('semana')} | {semana.get('objetivo_semana', '')} ---")
        tasks = semana.get("tarefas", [])
        if not tasks:
            print("  (sem tarefas)")
            continue
        for t in tasks:
            card = {
                "id": t.get("id", ""),
                "title": t.get("title", ""),
                "type": t.get("type", ""),
                "hours": t.get("hours", ""),
                "description": t.get("description", "")
            }
            # impressão “card”
            print(f'  - id: {card["id"]}')
            print(f'    title: {card["title"]}')
            print(f'    type: {card["type"]}')
            print(f'    hours: {card["hours"]}')
            print(f'    description: {card["description"]}')

def terminal_interface(model_objs):
    print("=== Formulário Perfil Comportamental ===")
    print("Use números para facilitar: 1-baixo, 2-médio, 3-alto (ou intensidade)")
    estilo_num = input("Estilo de Aprendizado (1-Teórico,2-Prático,3-Balanceado,4-Intensivo): ")
    tol_num = input("Tolerância a Desafios (1-baixa,2-média,3-alta): ")
    foco_num = input("Foco/Disciplina (1-baixo,2-médio,3-alto): ")
    res_num = input("Resiliência no Estudo (1-baixa,2-média,3-alto): ")

    print("\n=== Formulário Plano de Estudo ===")
    tema = input("Tema de Estudo (texto livre): ")
    conhecimento_num = input("Nível de entendimento (1-iniciante,2-intermediário,3-avançado): ")
    tempo = int(input("Tempo semanal disponível (horas, inteiro): "))
    objetivo_num = input("Objetivo do estudo (1-prova,2-projeto,3-hábito,4-aprendizado profundo): ")

    input_dict = {
        'estilo_aprendizado': ESTILOS.get(estilo_num, 'balanceado'),
        'tolerancia_dificuldade': NIVEIS.get(tol_num, 'media'),
        'nivel_foco': NIVEIS.get(foco_num, 'media'),
        'resiliencia_estudo': NIVEIS.get(res_num, 'media'),
        'conhecimento_tema': CONHECIMENTO.get(conhecimento_num, 'intermediario'),
        'tempo_semanal': tempo,
        'objetivo_estudo': OBJETIVOS.get(objetivo_num, 'aprendizado_profundo'),
        'texto_livre': tema
    }

    result = predict_with_explanation(model_objs, input_dict, top_k=3)
    principal_label, principal_proba = result['principal']

    print("\n=== Resultado ===")
    print(f"Classificação principal: {principal_label} ({principal_proba*100:.1f}%)")

    # Esqueleto local (apenas para contexto da API)
    plano_skel = generate_plan_skeleton(principal_label, input_dict['objetivo_estudo'], input_dict['texto_livre'])
    print("\nEsqueleto de plano (contexto enviado à API):")
    print(json.dumps(plano_skel, indent=2, ensure_ascii=False))

    semanas = 4
    try:
        plan_json = get_plan_from_gpt(
            skeleton=plano_skel,
            semanas=semanas,
            model="gpt-4o-mini",
            max_tokens=1200
        )
        print("\n=== Plano de estudo (JSON via ChatGPT) ===")
        print(json.dumps(plan_json, indent=2, ensure_ascii=False))

        # >>> impressão em formato de CARD
        _print_cards(plan_json)

        plan_path_abs = save_plan_to_json(plan_json, PLAN_PATH)
        print(f"\n[OK] Plano salvo em: {plan_path_abs}")

    except Exception as e:
        print("\n[AVISO] Não foi possível obter o plano via GPT:", str(e))
        print("Nada foi salvo (sem fallback local). Verifique OPENAI_API_KEY, quota e rede.")

def bootstrap_and_run():
    # Carrega o modelo se existir, senão treina e salva
    if Path(MODEL_PATH).exists():
        print(f"Carregando modelo existente: {Path(MODEL_PATH).resolve()}")
        model_objs = load_model(MODEL_PATH)
    else:
        print("Treinando modelo (primeira execução)...")
        df = generate_synthetic(2000)
        model_objs = train_model(df, max_depth=6)
        saved_at = save_model(model_objs, MODEL_PATH)
        print("Modelo treinado e salvo em:\n ", saved_at)
        print("Relatório de classificação:\n")
        print(model_objs['report'])

    terminal_interface(model_objs)

if __name__ == "__main__":
    bootstrap_and_run()
