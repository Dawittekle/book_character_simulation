import { lorelyApi } from '../services/lorelyApi';

const LEGACY_STORAGE_PREFIX = 'book-character-simulation-workspace:';

/**
 * Scans window.localStorage for legacy workspace books and chats,
 * and transfers them to the authoritative PostgreSQL backend via Lorely API.
 * Cleans up legacy localStorage keys upon verified server import.
 */
export async function checkAndMigrateLegacyWorkspaces(accessToken) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { status: 'skipped', reason: 'no-window' };
  }

  const legacyKeys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(LEGACY_STORAGE_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  if (legacyKeys.length === 0) {
    return { status: 'none', count: 0 };
  }

  let aggregatedBooks = [];
  for (const key of legacyKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.books)) {
          aggregatedBooks.push(...parsed.books);
        }
      }
    } catch (err) {
      console.warn('Failed to parse legacy workspace key:', key, err);
    }
  }

  if (aggregatedBooks.length === 0) {
    // Empty legacy stores, clean up keys
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
    return { status: 'cleaned_empty', count: 0 };
  }

  try {
    const res = await lorelyApi.migrateLegacyWorkspace(
      { books: aggregatedBooks },
      accessToken
    );

    // After successful server migration, remove the legacy keys from localStorage
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
    return {
      status: 'migrated',
      result: res,
    };
  } catch (err) {
    console.error('Legacy workspace migration to PostgreSQL failed:', err);
    return { status: 'error', error: err.message };
  }
}
