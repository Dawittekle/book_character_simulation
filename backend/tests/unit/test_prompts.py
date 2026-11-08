from __future__ import annotations

from book_character_simulation_backend.prompts import (
    character_extraction_prompt,
    chat_prompt,
    fact_extraction_prompt,
)


def test_character_extraction_prompt():
    sample_text = "Alice went through the looking glass and met the Red Queen."
    sys_prompt, user_prompt = character_extraction_prompt(sample_text)
    
    assert "strict JSON" in sys_prompt
    assert "psi_parameters" in user_prompt
    assert "emotion_state" in user_prompt
    assert sample_text in user_prompt


def test_chat_prompt():
    sys_prompt, user_prompt = chat_prompt(
        character_json='{"name": "Alice"}',
        chat_history="User: Hello\nAlice: Hi there!",
        factual_memories="Alice likes tea.",
        psi_parameters='{"valence_level": 0.8}',
        emotion_state='{"joy": 0.5}',
        latest_message="Where is the rabbit?",
    )
    
    assert "roleplaying as a book character" in sys_prompt
    assert "Alice" in user_prompt
    assert "Alice likes tea." in user_prompt
    assert "Where is the rabbit?" in user_prompt
    assert "updated_psi" in user_prompt
    assert "updated_emotion_state" in user_prompt


def test_fact_extraction_prompt():
    sys_prompt, user_prompt = fact_extraction_prompt(
        chat_history="User: My name is Arthur.",
        user_message="My name is Arthur.",
        character_response="Nice to meet you Arthur.",
    )
    
    assert "extract factual memories" in sys_prompt
    assert "Arthur" in user_prompt
    assert '"facts":' in user_prompt
