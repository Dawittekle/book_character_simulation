from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass

import fitz  # PyMuPDF

from ..errors import BadRequestError


@dataclass(slots=True)
class ExtractedDocument:
    text: str
    format: str  # 'pdf', 'epub', 'txt'
    page_count: int
    word_count: int
    embedded_title: str | None = None
    embedded_author: str | None = None


def detect_file_format(file_bytes: bytes, filename: str | None = None) -> str:
    if not file_bytes:
        raise BadRequestError("File is empty.")

    # 1. PDF signature check: %PDF-
    if file_bytes.startswith(b"%PDF-"):
        return "pdf"

    # 2. EPUB check: ZIP magic bytes PK\x03\x04 and contains mimetype file with epub
    if file_bytes.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                if "mimetype" in z.namelist():
                    mimetype_content = z.read("mimetype").decode("utf-8", errors="ignore").strip()
                    if "epub" in mimetype_content:
                        return "epub"
                # If zip contains META-INF/container.xml it's also an EPUB
                if any("META-INF/container.xml" in name for name in z.namelist()):
                    return "epub"
        except zipfile.BadZipFile:
            pass

    # 3. Plain text check: verify utf-8 or ascii decodability without null bytes
    if b"\x00" not in file_bytes[:1024]:
        try:
            file_bytes.decode("utf-8")
            return "txt"
        except UnicodeDecodeError:
            pass

    # Check filename extension fallback
    lower_name = (filename or "").lower()
    if lower_name.endswith(".pdf"):
        raise BadRequestError("The file has a .pdf extension but lacks a valid PDF header.")
    if lower_name.endswith(".epub"):
        raise BadRequestError("The file has a .epub extension but is not a valid EPUB archive.")

    raise BadRequestError("Unsupported file format. Please upload a PDF, EPUB, or TXT file.")


def extract_document_from_bytes(
    file_bytes: bytes, filename: str | None = None
) -> ExtractedDocument:
    file_fmt = detect_file_format(file_bytes, filename)

    if file_fmt == "txt":
        text = file_bytes.decode("utf-8", errors="replace").strip()
        words = len(re.findall(r"\w+", text))
        return ExtractedDocument(
            text=text,
            format="txt",
            page_count=max(1, words // 300),
            word_count=words,
        )

    # For PDF and EPUB, PyMuPDF (fitz) can open the stream directly
    try:
        doc = fitz.open(stream=file_bytes, filetype=file_fmt)
    except Exception as exc:
        raise BadRequestError(f"Failed to parse {file_fmt.upper()} document: {exc}") from exc

    metadata = doc.metadata or {}
    embedded_title = metadata.get("title") or None
    embedded_author = metadata.get("author") or None

    pages_text = []
    for page in doc:
        pages_text.append(page.get_text())

    full_text = "\n\n".join(pages_text).strip()
    words = len(re.findall(r"\w+", full_text))

    return ExtractedDocument(
        text=full_text,
        format=file_fmt,
        page_count=len(doc),
        word_count=words,
        embedded_title=embedded_title.strip() if embedded_title else None,
        embedded_author=embedded_author.strip() if embedded_author else None,
    )
