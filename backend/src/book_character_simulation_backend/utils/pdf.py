from __future__ import annotations

import fitz


def extract_text_from_pdf(uploaded_file) -> str:
    document = fitz.open(stream=uploaded_file.read(), filetype="pdf")
    pages: list[str] = []

    for page in document:
        pages.append(page.get_text("text"))

    return "\n".join(pages).strip()
