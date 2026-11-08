from __future__ import annotations

import pytest
from book_character_simulation_backend.utils.json import parse_json_response
from book_character_simulation_backend.errors import AppError


def test_parse_json_response_clean():
    raw = '{"name": "Elena Marlowe", "role": "writer"}'
    parsed = parse_json_response(raw)
    assert parsed["name"] == "Elena Marlowe"
    assert parsed["role"] == "writer"


def test_parse_json_response_markdown_blocks():
    raw = '```json\n[{"name": "Sherlock Holmes"}]\n```'
    parsed = parse_json_response(raw)
    assert isinstance(parsed, list)
    assert parsed[0]["name"] == "Sherlock Holmes"


def test_parse_json_response_embedded_text():
    raw = 'Here is the response:\n{"result": "success"}\nThank you!'
    parsed = parse_json_response(raw)
    assert parsed["result"] == "success"


def test_parse_json_response_invalid():
    raw = "Not a json payload at all"
    with pytest.raises(AppError):
        parse_json_response(raw)
