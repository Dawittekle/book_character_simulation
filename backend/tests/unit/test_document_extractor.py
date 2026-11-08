from __future__ import annotations

import io
import zipfile
import pytest

from book_character_simulation_backend.errors import BadRequestError
from book_character_simulation_backend.utils.document_extractor import (
    detect_file_format,
    extract_document_from_bytes,
)


def test_detect_file_format_pdf():
    pdf_bytes = b"%PDF-1.5\n%fake binary pdf content"
    assert detect_file_format(pdf_bytes, "test.pdf") == "pdf"


def test_detect_file_format_epub():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("mimetype", "application/epub+zip")
        z.writestr("META-INF/container.xml", "<container></container>")
    epub_bytes = buf.getvalue()

    assert detect_file_format(epub_bytes, "novel.epub") == "epub"


def test_detect_file_format_txt():
    txt_bytes = "Chapter 1\nThe voyage began at dawn.".encode("utf-8")
    assert detect_file_format(txt_bytes, "story.txt") == "txt"


def test_detect_file_format_unsupported():
    with pytest.raises(BadRequestError, match="Unsupported file format"):
        detect_file_format(b"\x00\x01\x02\x03\x04\x05raw_binary", "binary.bin")


def test_extract_txt_document():
    raw_text = "It was the best of times, it was the worst of times."
    doc = extract_document_from_bytes(raw_text.encode("utf-8"), "tale.txt")
    assert doc.format == "txt"
    assert doc.text == raw_text
    assert doc.word_count == 12
    assert doc.page_count >= 1
