def character_extraction_prompt(text: str) -> tuple[str, str]:
    system_prompt = (
        "You extract book characters into strict JSON. "
        "Return only valid JSON and do not wrap it in markdown."
    )

    user_prompt = f"""
Extract every meaningful character from the source text below.
Include protagonists, antagonists, villains, side characters, and recurring figures.

Return a JSON array. Every array item must have this shape:
{{
  "name": "Character name",
  "personality": "3-5 concise traits",
  "key_events": ["event 1", "event 2"],
  "relationships": ["relationship 1", "relationship 2"],
  "psi_parameters": {{
    "valence_level": 0.0,
    "arousal_level": 0.0,
    "selection_threshold": 0.0,
    "resolution_level": 0.0,
    "goal_directedness": 0.0,
    "securing_rate": 0.0
  }},
  "emotion_state": {{
    "anger": 0.0,
    "sadness": 0.0,
    "pride": 0.0,
    "joy": 0.0,
    "bliss": 0.0
  }}
}}

Rules:
- Keep numeric values between 0.0 and 1.0.
- Base the emotional state on the source text and the character's role.
- Keep personality concise.
- Return only JSON.

Source text:
\"\"\"
{text}
\"\"\"
""".strip()
    return system_prompt, user_prompt


def chat_prompt(
    *,
    character_json: str,
    chat_history: str,
    factual_memories: str,
    psi_parameters: str,
    emotion_state: str,
    latest_message: str,
) -> tuple[str, str]:
    system_prompt = (
        "You are roleplaying as a book character. "
        "Stay in character and return only valid JSON."
    )

    user_prompt = f"""
Character details:
{character_json}

Conversation history:
{chat_history}

Known factual memories:
{factual_memories}

Current psi parameters:
{psi_parameters}

Current emotion state:
{emotion_state}

Latest user message:
"{latest_message}"

Return a JSON object with this exact structure:
{{
  "reply": "character response",
  "updated_psi": {{
    "valence_level": 0.0,
    "arousal_level": 0.0,
    "selection_threshold": 0.0,
    "resolution_level": 0.0,
    "goal_directedness": 0.0,
    "securing_rate": 0.0
  }},
  "updated_emotion_state": {{
    "anger": 0.0,
    "sadness": 0.0,
    "pride": 0.0,
    "joy": 0.0,
    "bliss": 0.0
  }}
}}

Rules:
- Never break character.
- Use the factual memories if relevant.
- If the user's message is neutral, keep state updates small.
- Return only JSON.
""".strip()
    return system_prompt, user_prompt


def fact_extraction_prompt(
    *,
    chat_history: str,
    user_message: str,
    character_response: str,
) -> tuple[str, str]:
    system_prompt = (
        "You extract factual memories from a conversation. "
        "Return only valid JSON."
    )

    user_prompt = f"""
Conversation history:
{chat_history}

Latest exchange:
User: {user_message}
Character: {character_response}

Return this JSON object:
{{
  "facts": [
    "fact 1",
    "fact 2"
  ]
}}

Rules:
- Extract only objective facts worth remembering later.
- Ignore emotions, style, and opinions.
- If no new facts were shared, return {{"facts": []}}.
- Return only JSON.
""".strip()
    return system_prompt, user_prompt
