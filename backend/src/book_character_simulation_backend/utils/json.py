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
        start_obj = cleaned.find("{")
        start_arr = cleaned.find("[")
        if start_obj != -1 or start_arr != -1:
            if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
                end_obj = cleaned.rfind("}")
                if end_obj > start_obj:
                    try:
                        return json.loads(cleaned[start_obj : end_obj + 1])
                    except json.JSONDecodeError:
                        pass
            elif start_arr != -1:
                end_arr = cleaned.rfind("]")
                if end_arr > start_arr:
                    try:
                        return json.loads(cleaned[start_arr : end_arr + 1])
                    except json.JSONDecodeError:
                        pass

        raise AppError("The LLM returned invalid JSON.") from exc
