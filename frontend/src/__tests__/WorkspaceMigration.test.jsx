import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndMigrateLegacyWorkspaces } from '../lib/workspaceMigration';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    migrateLegacyWorkspace: vi.fn(),
  },
}));

describe('workspaceMigration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns none when no legacy workspace keys exist', async () => {
    const result = await checkAndMigrateLegacyWorkspaces('fake-token');
    expect(result.status).toBe('none');
    expect(lorelyApi.migrateLegacyWorkspace).not.toHaveBeenCalled();
  });

  it('detects legacy localStorage workspace, calls backend migration, and cleans keys', async () => {
    const legacyKey = 'book-character-simulation-workspace:reader-123';
    const legacyData = {
      books: [
        {
          textId: 'legacy-1',
          title: 'Notes from Underground',
          author: 'Dostoevsky',
          characters: [{ id: 'char-u', name: 'Underground Man' }],
        },
      ],
    };
    window.localStorage.setItem(legacyKey, JSON.stringify(legacyData));

    lorelyApi.migrateLegacyWorkspace.mockResolvedValueOnce({
      status: 'success',
      migrated_books: 1,
    });

    const result = await checkAndMigrateLegacyWorkspaces('mock-token');
    expect(result.status).toBe('migrated');
    expect(lorelyApi.migrateLegacyWorkspace).toHaveBeenCalledWith(
      { books: legacyData.books },
      'mock-token'
    );

    // Verify the legacy key was removed from localStorage
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('handles backend migration error gracefully without removing localStorage keys', async () => {
    const legacyKey = 'book-character-simulation-workspace:reader-456';
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({ books: [{ textId: 'legacy-2', title: 'The Idiot' }] })
    );

    lorelyApi.migrateLegacyWorkspace.mockRejectedValueOnce(
      new Error('Network error during migration')
    );

    const result = await checkAndMigrateLegacyWorkspaces('mock-token');
    expect(result.status).toBe('error');

    // Local storage key should NOT be deleted so it can retry later
    expect(window.localStorage.getItem(legacyKey)).not.toBeNull();
  });
});
