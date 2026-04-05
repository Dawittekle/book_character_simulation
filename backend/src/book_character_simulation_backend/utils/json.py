from __future__ import annotations

import json

from ..errors import AppError


def parse_json_response(raw_response: str):
    cleaned = raw_response.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AppError("The LLM returned invalid JSON.") from exc
