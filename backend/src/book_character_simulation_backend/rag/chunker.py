from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(slots=True)
class SemanticChunk:
    chapter_order: int
    chapter_title: str
    chunk_index: int
    content: str


CHAPTER_PATTERN = re.compile(
    r"(?i)^(?:chapter|part|act|scene|book|prologue|epilogue)\b[^\n]*",
    re.MULTILINE,
)


def split_into_chapters(text: str) -> list[tuple[int, str, str]]:
    matches = list(CHAPTER_PATTERN.finditer(text))
    if not matches:
        return [(1, "Full Story", text.strip())]

    chapters = []
    # If there is content before the first chapter header
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            chapters.append((0, "Prologue / Introduction", preamble))

    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        raw_header = match.group(0).strip()
        chapter_content = text[start:end].strip()
        chapter_num = idx + 1
        chapters.append((chapter_num, raw_header, chapter_content))

    return chapters


def chunk_chapter_text(
    chapter_order: int,
    chapter_title: str,
    text: str,
    max_words_per_chunk: int = 350,
) -> list[SemanticChunk]:
    # Split by paragraphs
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[SemanticChunk] = []
    current_paragraphs: list[str] = []
    current_word_count = 0
    chunk_idx = 0

    for para in paragraphs:
        para_words = len(re.findall(r"\w+", para))
        if current_word_count + para_words > max_words_per_chunk and current_paragraphs:
            content = "\n\n".join(current_paragraphs)
            chunks.append(
                SemanticChunk(
                    chapter_order=chapter_order,
                    chapter_title=chapter_title,
                    chunk_index=chunk_idx,
                    content=content,
                )
            )
            chunk_idx += 1
            current_paragraphs = [para]
            current_word_count = para_words
        else:
            current_paragraphs.append(para)
            current_word_count += para_words

    if current_paragraphs:
        content = "\n\n".join(current_paragraphs)
        chunks.append(
            SemanticChunk(
                chapter_order=chapter_order,
                chapter_title=chapter_title,
                chunk_index=chunk_idx,
                content=content,
            )
        )

    return chunks


def build_semantic_chunks(text: str, max_words_per_chunk: int = 350) -> list[SemanticChunk]:
    chapters = split_into_chapters(text)
    all_chunks: list[SemanticChunk] = []

    for chapter_num, chapter_title, chapter_text in chapters:
        chapter_chunks = chunk_chapter_text(
            chapter_num, chapter_title, chapter_text, max_words_per_chunk=max_words_per_chunk
        )
        all_chunks.extend(chapter_chunks)

    # Renumber global chunk index
    for global_idx, c in enumerate(all_chunks):
        c.chunk_index = global_idx

    return all_chunks
