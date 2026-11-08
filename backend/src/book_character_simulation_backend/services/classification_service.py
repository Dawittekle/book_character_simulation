from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from ..llm.factory import get_llm_provider
from ..utils.json import parse_json_response

logger = logging.getLogger(__name__)

DOCUMENT_CLASSIFICATION_PROMPT = """
You are a literary and document classifier for Lorely, an application where users explore books and talk to fictional characters.

Analyze the following document sample and determine whether it is a narrative creative work (book, novel, short story, manuscript) or a non-narrative document (such as a job application, cover letter, curriculum vitae/resume, invoice, business report, memo, or contract).

Important Rules:
1. If the text is a cover letter, CV, resume, or business correspondence, classify it as "document". DO NOT classify applicant names or employers as fictional characters.
2. If it is a full novel or book-length narrative, classify as "book".
3. If it is a short story, screenplay, or play, classify as "story".
4. If there is insufficient evidence to decide, classify as "unknown".

Return a JSON object with this exact shape:
{
  "document_type": "book" | "story" | "document" | "unknown",
  "confidence": 0.95,
  "title": "Inferred Title or Document Header",
  "author": "Inferred Author or Applicant Name",
  "is_narrative": true,
  "reasoning": "Concise 1-sentence explanation of why this was classified as such.",
  "warning": "Warning message to user if document_type is 'document', or null otherwise."
}

Document sample:
\"\"\"
{sample_text}
\"\"\"
""".strip()


@dataclass(slots=True)
class ClassificationResult:
    document_type: str  # 'book', 'story', 'document', 'unknown'
    confidence: float
    title: str | None
    author: str | None
    is_narrative: bool
    reasoning: str
    warning: str | None


class ClassificationService:
    def __init__(self, settings: Any):
        self.settings = settings

    @staticmethod
    def _heuristic_check(sample_text: str) -> ClassificationResult | None:
        lower = sample_text.lower()

        # Strong document keywords
        cv_indicators = [
            r"\bcurriculum vitae\b",
            r"\br[eé]sum[eé]\b",
            r"\bcover letter\b",
            r"\bdear hiring manager\b",
            r"\bdear recruiter\b",
            r"\bjob application\b",
            r"\bposition of\b",
            r"\bwork experience\b",
            r"\beducation\s*:",
            r"\breferences available upon request\b",
            r"\bsincerely,\b",
            r"\byours sincerely\b",
        ]

        matches = sum(1 for pattern in cv_indicators if re.search(pattern, lower))
        if matches >= 2:
            # Extract possible author / applicant from letter header or sign-off
            author = None
            sign_match = re.search(r"(?:sincerely|regards|best regards|respectfully)[\s,]+([A-Z][a-z]+ [A-Z][a-z]+)", sample_text, re.IGNORECASE)
            if sign_match:
                author = sign_match.group(1).strip()

            return ClassificationResult(
                document_type="document",
                confidence=0.98,
                title="Professional Document / Application",
                author=author,
                is_narrative=False,
                reasoning="Heuristic detection identified formal job application / CV indicators.",
                warning="This file appears to be a resume or cover letter rather than a story or book. Extracting characters from a document may mistake real people for fictional entities.",
            )

        return None

    def classify_text(
        self,
        text: str,
        *,
        filename: str | None = None,
        embedded_title: str | None = None,
        embedded_author: str | None = None,
        llm_provider: str | None = None,
    ) -> ClassificationResult:
        # Check filename for obvious clues
        lower_fn = (filename or "").lower()
        if any(term in lower_fn for term in ["cover_letter", "coverletter", "resume", "cv_", "curriculum_vitae"]):
            heuristic = self._heuristic_check(text[:3000])
            if heuristic:
                return heuristic

        # Check heuristics first
        sample = text[:4000].strip()
        heuristic = self._heuristic_check(sample)
        if heuristic and heuristic.confidence >= 0.95:
            return heuristic

        # Run LLM classification
        try:
            default_provider = getattr(self.settings, "llm_provider", "gemini") if self.settings else "gemini"
            provider = get_llm_provider(
                self.settings,
                provider_name=llm_provider or default_provider,
            )
            system_prompt = "You are a literary and document classifier for Lorely. Return only valid JSON."
            user_prompt = DOCUMENT_CLASSIFICATION_PROMPT.replace("{sample_text}", sample)
            raw = provider.generate_json(system_prompt=system_prompt, user_prompt=user_prompt)
            data = parse_json_response(raw)

            doc_type = data.get("document_type", "unknown").lower()
            if doc_type not in ("book", "story", "document", "unknown"):
                doc_type = "unknown"

            confidence = float(data.get("confidence", 0.7))
            title = embedded_title or data.get("title") or (filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else None)
            author = embedded_author or data.get("author")
            is_narrative = bool(data.get("is_narrative", doc_type in ("book", "story")))
            reasoning = data.get("reasoning", "Classified based on content analysis.")
            warning = data.get("warning")
            if doc_type == "document" and not warning:
                warning = "This file appears to be a document or professional record rather than a narrative book. Character extraction may mistake real people for fictional entities."

            return ClassificationResult(
                document_type=doc_type,
                confidence=confidence,
                title=title,
                author=author,
                is_narrative=is_narrative,
                reasoning=reasoning,
                warning=warning,
            )
        except Exception as exc:
            logger.warning("LLM content classification failed, falling back to heuristic: %s", exc)
            return ClassificationResult(
                document_type="unknown",
                confidence=0.5,
                title=embedded_title or (filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else "Untitled"),
                author=embedded_author,
                is_narrative=True,
                reasoning="Classification fallback.",
                warning=None,
            )
