import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiService from '../services/api';

describe('apiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractCharacters', () => {
    it('sends POST request to /extract-characters with FormData', async () => {
      const mockResponse = {
        book_id: 'book-123',
        characters: [{ id: 'char-1', name: 'Elena Marlowe' }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.extractCharacters({
        text: 'Some manuscript text',
        llmProvider: 'gemini',
        accessToken: 'test-token',
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];

      expect(url).toContain('/extract-characters');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ Authorization: 'Bearer test-token' });
      expect(options.body).toBeInstanceOf(FormData);
      expect(result).toEqual(mockResponse);
    });

    it('throws error when server responds with non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Invalid file format' }),
      });

      await expect(
        apiService.extractCharacters({ text: 'text' }),
      ).rejects.toThrow('Invalid file format');
    });
  });

  describe('chatWithCharacter', () => {
    it('sends POST request to /chat/:characterId and returns message response', async () => {
      const mockChatResponse = {
        response: 'Hello, reader.',
        character: { name: 'Elena' },
        updated_state: { emotion_state: { joy: 0.8 } },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockChatResponse,
      });

      const response = await apiService.chatWithCharacter({
        characterId: 'char-123',
        message: 'Who are you?',
        textId: 'book-456',
        sessionId: 'sess-789',
        llmProvider: 'gemini',
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];

      expect(url).toContain('/chat/char-123');
      expect(options.method).toBe('POST');
      expect(response).toEqual(mockChatResponse);
    });

    it('unwraps array response if server returns array', async () => {
      const mockTurn = { response: 'Unwrapped turn' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [mockTurn],
      });

      const response = await apiService.chatWithCharacter({
        characterId: 'char-1',
        message: 'Hi',
        textId: 'b-1',
      });

      expect(response).toEqual(mockTurn);
    });
  });
});
