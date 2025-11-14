# io_json.py
import json
from pathlib import Path
from typing import Any, Dict

def save_plan_to_json(plan: Dict[str, Any], path: str = "artifacts/plano_estudos.json") -> str:
    out = Path(path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(out)

def load_json(path: str) -> Dict[str, Any]:
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8"))
