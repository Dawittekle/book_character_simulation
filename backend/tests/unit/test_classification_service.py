from __future__ import annotations

import json
from book_character_simulation_backend.services.classification_service import ClassificationService


def test_classify_cover_letter_heuristic():
    classifier = ClassificationService(settings=None)
    cover_letter_text = """
    Dawit Teklebrhan
    Addis Ababa, Ethiopia
    teklebrahandawit309@gmail.com

    Dear Hiring Manager,

    I am writing to express my strong interest in the Senior Full-Stack Engineer position at your company.
    With over 5 years of work experience building distributed cloud applications and AI integrations,
    I have developed deep technical expertise.

    My education includes a B.S. in Computer Science. References available upon request.

    Sincerely,
    Dawit Teklebrhan
    """

    result = classifier.classify_text(cover_letter_text, filename="cover_letter.pdf")
    assert result.document_type == "document"
    assert result.is_narrative is False
    assert result.confidence >= 0.9
    assert result.warning is not None
    assert "resume or cover letter" in result.warning
    assert result.author == "Dawit Teklebrhan"


def test_classify_book_with_llm(test_settings, monkeypatch):
    classifier = ClassificationService(settings=test_settings)

    novel_text = """
    Chapter One: The Arrival at Netherfield

    Mr. Bennet was among the earliest of those who waited on Mr. Bingley.
    He had always intended to visit him, though to the last always assuring his wife
    that he should not go; and till the evening after the visit was paid she had no
    knowledge of it. It was then disclosed in the following manner.
    """

    mock_llm_response = json.dumps({
        "document_type": "book",
        "confidence": 0.98,
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "is_narrative": True,
        "reasoning": "Classic narrative novel opening with chapter header and dialogue.",
        "warning": None,
    })

    from book_character_simulation_backend.llm.gemini_provider import GeminiProvider
    monkeypatch.setattr(
        GeminiProvider,
        "generate_json",
        lambda self, system_prompt, user_prompt: mock_llm_response,
    )

    result = classifier.classify_text(novel_text, filename="pride_and_prejudice.epub")
    assert result.document_type == "book"
    assert result.is_narrative is True
    assert result.title == "Pride and Prejudice"
    assert result.author == "Jane Austen"
    assert result.warning is None
