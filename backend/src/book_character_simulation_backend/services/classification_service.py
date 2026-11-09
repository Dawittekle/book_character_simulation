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

Analyze the following document sample and determine whether it is a narrative creative work (book, novel, short story, manuscript, play) or a non-narrative document (such as a job application, cover letter, curriculum vitae/resume, invoice, business report, academic paper, technical documentation, memo, or contract).

Important Rules:
1. If the text is a cover letter, CV, resume, or business correspondence, classify it as "document", genre "resume" or "cover_letter", supported_for_character_simulation: false. DO NOT classify applicant names or employers as fictional characters.
2. If it is an invoice, receipt, or financial statement, classify as "document", genre "invoice", supported_for_character_simulation: false.
3. If it is an academic paper, journal article, or technical document, classify as "document", genre "academic_paper" or "technical_docs", supported_for_character_simulation: false.
4. If it is a full novel or book-length narrative, classify as "book", genre "novel", supported_for_character_simulation: true.
5. If it is a short story, classify as "story", genre "short_story", supported_for_character_simulation: true.
6. If it is a script or theatrical play, classify as "story", genre "play", supported_for_character_simulation: true.
7. Detect the primary language (e.g. "en", "am", "fr", "es", "de").

Return a JSON object with this exact shape:
{
  "document_type": "book" | "story" | "document" | "unknown",
  "genre": "novel" | "short_story" | "play" | "memoir" | "resume" | "cover_letter" | "invoice" | "academic_paper" | "technical_docs" | "general",
  "language": "en",
  "confidence": 0.95,
  "title": "Inferred Title or Document Header",
  "author": "Inferred Author or Applicant Name",
  "is_narrative": true,
  "supported_for_character_simulation": true,
  "reasoning": "Concise 1-sentence explanation of why this was classified as such.",
  "warning": "Warning message to user if document is non-narrative, or null otherwise."
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
    genre: str | None = None
    language: str = "en"
    supported_for_character_simulation: bool = True


class ClassificationService:
    def __init__(self, settings: Any):
        self.settings = settings

    @staticmethod
    def _heuristic_check(sample_text: str) -> ClassificationResult | None:
        lower = sample_text.lower()

        # 1. Job application / Resume / CV
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
        if sum(1 for pattern in cv_indicators if re.search(pattern, lower)) >= 2:
            author = None
            sign_match = re.search(
                r"(?:sincerely|regards|best regards|respectfully)[\s,]+([A-Z][a-z]+ [A-Z][a-z]+)",
                sample_text,
                re.IGNORECASE,
            )
            if sign_match:
                author = sign_match.group(1).strip()

            genre = "resume" if any(k in lower for k in ["experience", "curriculum", "resume", "cv"]) else "cover_letter"
            return ClassificationResult(
                document_type="document",
                genre=genre,
                confidence=0.98,
                title="Professional Document / Application",
                author=author,
                is_narrative=False,
                supported_for_character_simulation=False,
                reasoning="Heuristic detection identified formal job application / CV indicators.",
                warning="This file appears to be a resume or cover letter rather than a story or book. Extracting characters from a document may mistake real people for fictional entities.",
            )

        # 2. Financial invoice / Receipt
        invoice_indicators = [
            r"\binvoice\b",
            r"\btotal due\b",
            r"\bbill to\b",
            r"\bpayment terms\b",
            r"\bamount due\b",
            r"\bvat reg(?:istration)?\b",
            r"\bsubtotal\b",
            r"\bunit price\b",
            r"\breceipt #\b",
            r"\bdue date\s*:",
        ]
        if sum(1 for p in invoice_indicators if re.search(p, lower)) >= 2:
            return ClassificationResult(
                document_type="document",
                genre="invoice",
                confidence=0.98,
                title="Financial Invoice / Receipt",
                author=None,
                is_narrative=False,
                supported_for_character_simulation=False,
                reasoning="Heuristic detection identified commercial billing and payment indicators.",
                warning="This document appears to be an invoice or receipt. Character extraction is disabled for financial documents.",
            )

        # 3. Academic paper / Journal article
        academic_indicators = [
            r"\babstract\s*[\n:]",
            r"\bkeywords\s*:",
            r"\bmethodology\b",
            r"\bdoi:\s*10\.",
            r"\bconclusions?\b",
            r"\bpeer review\b",
            r"\bliterature review\b",
            r"\breferences\s*[\n:]",
        ]
        if sum(1 for p in academic_indicators if re.search(p, lower)) >= 3:
            return ClassificationResult(
                document_type="document",
                genre="academic_paper",
                confidence=0.94,
                title="Academic / Research Paper",
                author=None,
                is_narrative=False,
                supported_for_character_simulation=False,
                reasoning="Heuristic detection identified academic paper structural sections (abstract, methodology, references).",
                warning="This document appears to be an academic or research paper rather than a literary fiction work.",
            )

        # 4. Technical documentation
        tech_indicators = [
            r"\bapi reference\b",
            r"\bsdk guide\b",
            r"\binstallation instructions\b",
            r"\bendpoint:\s*(?:get|post|put|delete)\b",
            r"\bprerequisites\b",
        ]
        if sum(1 for p in tech_indicators if re.search(p, lower)) >= 2:
            return ClassificationResult(
                document_type="document",
                genre="technical_docs",
                confidence=0.92,
                title="Technical Documentation",
                author=None,
                is_narrative=False,
                supported_for_character_simulation=False,
                reasoning="Heuristic detection identified technical software documentation or API guide.",
                warning="This document appears to be technical software documentation rather than a narrative book.",
            )

        # 5. Play / Dramatic script
        if len(re.findall(r"^[A-Z]{2,15}\s*:", sample_text, re.MULTILINE)) >= 3:
            return ClassificationResult(
                document_type="story",
                genre="play",
                confidence=0.92,
                title="Dramatic Script / Play",
                author=None,
                is_narrative=True,
                supported_for_character_simulation=True,
                reasoning="Heuristic detection identified theatrical script dialogue markers.",
                warning=None,
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
            return ClassificationResult(
                document_type="document",
                genre="resume",
                confidence=0.95,
                title=(filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else "Resume Document"),
                author=None,
                is_narrative=False,
                supported_for_character_simulation=False,
                reasoning=f"Filename '{filename}' indicates a professional resume or CV rather than a literary narrative.",
                warning="This document appears to be a resume or CV. Lorely is designed for stories and literary books so characters have rich dialogue and storylines. You can check 'Force extraction' if you'd like to proceed anyway.",
            )

        # Check heuristics first
        sample = text[:4000].strip()
        heuristic = self._heuristic_check(sample)
        if heuristic and heuristic.confidence >= 0.90:
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
            genre = data.get("genre", "novel" if is_narrative else "document")
            language = data.get("language", "en")
            supported_for_character_simulation = bool(
                data.get("supported_for_character_simulation", is_narrative and doc_type != "document")
            )
            reasoning = data.get("reasoning", "Classified based on content analysis.")
            warning = data.get("warning")
            if not supported_for_character_simulation and not warning:
                warning = "This file appears to be a non-narrative document. Character extraction may mistake real people for fictional entities."

            return ClassificationResult(
                document_type=doc_type,
                genre=genre,
                language=language,
                confidence=confidence,
                title=title,
                author=author,
                is_narrative=is_narrative,
                supported_for_character_simulation=supported_for_character_simulation,
                reasoning=reasoning,
                warning=warning,
            )
        except Exception as exc:
            logger.warning("LLM content classification failed, falling back to heuristic: %s", exc)
            return ClassificationResult(
                document_type="unknown",
                genre="general",
                confidence=0.5,
                title=embedded_title or (filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else "Untitled"),
                author=embedded_author,
                is_narrative=True,
                supported_for_character_simulation=True,
                reasoning="Classification fallback.",
                warning=None,
            )
