import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AskCharacterDrawer from '../components/reader/AskCharacterDrawer';
import SelectionActionPill from '../components/reader/SelectionActionPill';
import TableOfContentsDrawer from '../components/reader/TableOfContentsDrawer';
import AddNoteModal from '../components/reader/AddNoteModal';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    sendReaderContextualChat: vi.fn(),
    createReaderAnnotation: vi.fn(),
    deleteReaderAnnotation: vi.fn(),
    createReaderBookmark: vi.fn(),
    deleteReaderBookmark: vi.fn(),
  },
}));

describe('Phase 5: Annotations & Ask a Character Drawer', () => {
  const mockCharacters = [
    { id: 'char-elizabeth', name: 'Elizabeth Bennet', role: 'Protagonist' },
    { id: 'char-darcy', name: 'Fitzwilliam Darcy', role: 'Deuteragonist' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AskCharacterDrawer with pinned passage quote and characters selector', () => {
    render(
      <AskCharacterDrawer
        isOpen={true}
        onClose={vi.fn()}
        bookId="book-test"
        passageQuote="It is a truth universally acknowledged..."
        chapterIndex={0}
        chapterTitle="Chapter I"
        characters={mockCharacters}
        themeId="parchment"
      />
    );

    expect(screen.getByText(/Ask a Character/i)).toBeInTheDocument();
    expect(screen.getByText(/It is a truth universally acknowledged\.\.\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/Elizabeth Bennet/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Suggested inquiries/i)).toBeInTheDocument();
  });

  it('sends contextual character chat with spoiler-gated chapter boundary', async () => {
    lorelyApi.sendReaderContextualChat.mockResolvedValueOnce({
      session_id: 'chat-sess-123',
      assistant_message_id: 'msg-456',
      response: 'I assure you, my dear friend, that my observations are made without malice.',
      character: { id: 'char-elizabeth', name: 'Elizabeth Bennet' },
      citations: [{ chapter_order: 1, snippet: 'universally acknowledged' }],
    });

    render(
      <AskCharacterDrawer
        isOpen={true}
        onClose={vi.fn()}
        bookId="book-test"
        passageQuote="It is a truth universally acknowledged..."
        chapterIndex={0}
        chapterTitle="Chapter I"
        characters={mockCharacters}
        themeId="parchment"
        session={{ access_token: 'fake-token' }}
      />
    );

    const input = screen.getByPlaceholderText(/Ask Elizabeth Bennet about this quote/i);
    fireEvent.change(input, { target: { value: 'Why do you say this?' } });

    const submitBtn = screen.getByLabelText(/Send message/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(lorelyApi.sendReaderContextualChat).toHaveBeenCalledWith(
        'book-test',
        {
          character_id: 'char-elizabeth',
          passage_quote: 'It is a truth universally acknowledged...',
          user_message: 'Why do you say this?',
          chapter_index: 1, // 1-based index
          session_id: undefined,
        },
        'fake-token'
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/I assure you, my dear friend, that my observations are made without malice/i)
      ).toBeInTheDocument();
    });
  });

  it('renders SelectionActionPill with 4 pastel tones and action triggers', () => {
    const handleHighlight = vi.fn();
    const handleAsk = vi.fn();
    const handleBookmark = vi.fn();
    const handleAddNote = vi.fn();

    const selection = {
      text: 'Elizabeth smiled with serene amusement.',
      rect: { top: 100, left: 150, width: 200, height: 20 },
    };

    render(
      <SelectionActionPill
        selection={selection}
        onHighlight={handleHighlight}
        onAskCharacter={handleAsk}
        onBookmark={handleBookmark}
        onAddNote={handleAddNote}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Ask Character/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Highlight in Yellow/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Highlight in Amber/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Highlight in Rose/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Highlight in Sage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Add note/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bookmark location/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Highlight in Rose/i));
    expect(handleHighlight).toHaveBeenCalledWith(selection, 'rose');

    fireEvent.click(screen.getByLabelText(/Ask Character/i));
    expect(handleAsk).toHaveBeenCalledWith(selection);
  });

  it('renders TableOfContentsDrawer with Bookmarks and Notes tabs', () => {
    const mockBookmarks = [
      {
        id: 'bm-1',
        chapter_index: 2,
        chapter_title: 'Chapter III',
        progress_percent: 33,
        snippet: 'A memorable evening at Netherfield.',
      },
    ];

    const mockAnnotations = [
      {
        id: 'ann-1',
        chapter_index: 2,
        selected_text: 'Elizabeth remained quietly observant.',
        color: 'rose',
        note: 'Classic Elizabeth subtlety.',
      },
    ];

    const handleDeleteBookmark = vi.fn();
    const handleDeleteAnnotation = vi.fn();

    render(
      <TableOfContentsDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={[{ id: 'ch-1', title: 'Chapter I', chapter_order: 0 }]}
        currentChapterIndex={0}
        onSelectChapter={vi.fn()}
        bookmarks={mockBookmarks}
        annotations={mockAnnotations}
        onDeleteBookmark={handleDeleteBookmark}
        onDeleteAnnotation={handleDeleteAnnotation}
      />
    );

    // Switch to Bookmarks tab
    const bookmarksTab = screen.getByText(/Bookmarks \(1\)/i);
    fireEvent.click(bookmarksTab);
    expect(screen.getByText(/A memorable evening at Netherfield/i)).toBeInTheDocument();

    // Switch to Annotations tab
    const annotationsTab = screen.getByText(/Notes \(1\)/i);
    fireEvent.click(annotationsTab);
    expect(screen.getByText(/Elizabeth remained quietly observant/i)).toBeInTheDocument();
    expect(screen.getByText(/Classic Elizabeth subtlety/i)).toBeInTheDocument();
  });

  it('renders AddNoteModal and submits note', async () => {
    const handleSave = vi.fn().mockResolvedValueOnce();
    const selection = { text: 'He looked at her with sudden, involuntary admiration.' };

    render(
      <AddNoteModal
        isOpen={true}
        onClose={vi.fn()}
        selection={selection}
        chapterIndex={1}
        onSaveNote={handleSave}
      />
    );

    expect(screen.getByText(/Add Margin Note/i)).toBeInTheDocument();
    expect(screen.getByText(/He looked at her with sudden, involuntary admiration/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Record your thoughts/i);
    fireEvent.change(textarea, { target: { value: 'Turning point in Darcy\'s perspective.' } });

    const submit = screen.getByText(/Save Note/i);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        selectedText: 'He looked at her with sudden, involuntary admiration.',
        chapterIndex: 1,
        color: 'amber',
        note: 'Turning point in Darcy\'s perspective.',
        locatorPayload: {},
      });
    });
  });
});
