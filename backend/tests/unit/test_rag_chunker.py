from book_character_simulation_backend.rag.chunker import (
    build_semantic_chunks,
    chunk_chapter_text,
    split_into_chapters,
)


SAMPLE_BOOK_TEXT = """
Prologue: The Forgotten Realm
Long before the cities arose, the ancient library stood silent under the stars.

Chapter 1: The Midnight Call
Elena sat by the flickering candle, watching ink soak into parchment.
She received a strange letter sealed with blue wax.

Chapter 2: The Whispering Gallery
The shadows whispered secrets about the clocktower that kept the world moving.
Elena realized that Victor had lied to her all along.

Chapter 3: The Final Betrayal
The tower bells toll twelve times as the betrayal is revealed to the city.
"""


def test_split_into_chapters_detects_headers():
    chapters = split_into_chapters(SAMPLE_BOOK_TEXT)
    assert len(chapters) == 4
    # Check chapter titles
    assert "Prologue" in chapters[0][1]
    assert "Chapter 1" in chapters[1][1]
    assert "Chapter 2" in chapters[2][1]
    assert "Chapter 3" in chapters[3][1]


def test_chunk_chapter_text_respects_paragraph_boundaries():
    text = (
        "Paragraph one is about the beginning.\n\n"
        "Paragraph two continues the story with deeper detail.\n\n"
        "Paragraph three concludes this small section."
    )
    chunks = chunk_chapter_text(chapter_order=1, chapter_title="Chapter 1", text=text, max_words_per_chunk=10)
    assert len(chunks) >= 2
    assert all(c.chapter_order == 1 for c in chunks)
    assert all(c.chapter_title == "Chapter 1" for c in chunks)


def test_build_semantic_chunks_end_to_end():
    chunks = build_semantic_chunks(SAMPLE_BOOK_TEXT, max_words_per_chunk=30)
    assert len(chunks) >= 4
    # All chunks should have non-empty content and valid indices
    for chunk in chunks:
        assert chunk.content.strip()
        assert chunk.chapter_order >= 0
        assert chunk.chunk_index >= 0
