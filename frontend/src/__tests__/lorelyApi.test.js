import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import lorelyApi from '../services/lorelyApi';

describe('lorelyApi client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User profile & settings', () => {
    it('calls GET /me with Bearer token', async () => {
      const mockProfile = { id: 'u1', email: 'reader@test.com', role: 'user' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      });

      const res = await lorelyApi.getMe('test-token');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/me');
      expect(opts.headers['Authorization']).toBe('Bearer test-token');
      expect(res).toEqual(mockProfile);
    });

    it('calls PATCH /me/settings with payload', async () => {
      const mockUpdated = { reading_theme: 'dark_ink' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUpdated,
      });

      const res = await lorelyApi.updateSettings({ reading_theme: 'dark_ink' }, 'test-token');
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/me/settings');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ reading_theme: 'dark_ink' });
      expect(res).toEqual(mockUpdated);
    });
  });

  describe('Books', () => {
    it('calls GET /books and returns books array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ books: [{ id: 'b1', title: 'Dracula' }] }),
      });

      const books = await lorelyApi.listBooks('token');
      expect(books).toEqual([{ id: 'b1', title: 'Dracula' }]);
    });

    it('calls POST /books with title and metadata', async () => {
      const newBook = { id: 'b2', title: 'Emma' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => newBook,
      });

      const res = await lorelyApi.createBook(
        { title: 'Emma', author: 'Jane Austen' },
        'token',
      );
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/books');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).title).toBe('Emma');
      expect(res).toEqual(newBook);
    });

    it('calls DELETE /books/:id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Deleted' }),
      });

      const res = await lorelyApi.deleteBook('b1', 'token');
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/books/b1');
      expect(opts.method).toBe('DELETE');
      expect(res).toEqual({ message: 'Deleted' });
    });
  });

  describe('Conversations', () => {
    it('appends query parameters when listing conversations by characterId', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ conversations: [] }),
      });

      await lorelyApi.listConversations({ characterId: 'char-1' }, 'token');
      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/conversations?character_id=char-1');
    });

    it('sends message turn via POST /conversations/:id/messages', async () => {
      const mockTurn = {
        response: 'Hello reader',
        updated_state: { emotion_state: { joy: 0.9 } },
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTurn,
      });

      const res = await lorelyApi.sendConversationMessage(
        'sess-1',
        { content: 'Hi there', inputModality: 'text' },
        'token',
      );
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/conversations/sess-1/messages');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).content).toBe('Hi there');
      expect(res).toEqual(mockTurn);
    });
  });

  describe('Document Inspection & Ingestion Gate', () => {
    it('calls POST /books/inspect with text and returns classification', async () => {
      const mockInspection = {
        temp_source_id: 'job-123',
        document_type: 'document',
        is_narrative: false,
        warning: 'This appears to be a resume/cover letter.',
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockInspection,
      });

      const res = await lorelyApi.inspectSource(
        { text: 'Dear Hiring Manager', filename: 'cover_letter.pdf' },
        'token',
      );
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/books/inspect');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body).filename).toBe('cover_letter.pdf');
      expect(res).toEqual(mockInspection);
    });

    it('calls POST /books/ingest with forceExtraction flag', async () => {
      const mockIngest = {
        job_id: 'job-123',
        status: 'completed',
        book_id: 'book-456',
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockIngest,
      });

      const res = await lorelyApi.ingestSource(
        { tempSourceId: 'job-123', forceExtraction: true },
        'token',
      );
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/books/ingest');
      expect(JSON.parse(opts.body).force_extraction).toBe(true);
      expect(res).toEqual(mockIngest);
    });

    it('calls GET /jobs/:jobId to poll job status', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'completed',
        progress: 100,
        stage: 'ready',
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockJob,
      });

      const res = await lorelyApi.getJobStatus('job-123', 'token');
      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/api/v1/jobs/job-123');
      expect(res).toEqual(mockJob);
    });
  });
});
