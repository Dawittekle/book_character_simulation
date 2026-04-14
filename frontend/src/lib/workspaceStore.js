const STORAGE_PREFIX = 'book-character-simulation-workspace';

function storageKey(ownerKey) {
  return `${STORAGE_PREFIX}:${ownerKey}`;
}

function emptyState() {
  return {
    books: [],
  };
}

function normalizeBook(book) {
  const characters = Array.isArray(book?.characters) ? book.characters : [];
  const createdAt = book?.createdAt || new Date().toISOString();
  const characterSessions =
    book?.characterSessions && typeof book.characterSessions === 'object'
      ? book.characterSessions
      : {};

  return {
    textId: book?.textId || '',
    title: book?.title || 'Untitled Book',
    preview: book?.preview || '',
    sourceType: book?.sourceType || 'text',
    sourceLabel: book?.sourceLabel || 'Manual text',
    preferredProvider: book?.preferredProvider || 'server_default',
    createdAt,
    updatedAt: book?.updatedAt || createdAt,
    activeCharacterId: book?.activeCharacterId || characters[0]?.id || null,
    characters,
    characterSessions,
  };
}

function readState(ownerKey) {
  if (typeof window === 'undefined') {
    return emptyState();
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey(ownerKey));
    if (!rawValue) {
      return emptyState();
    }

    const parsed = JSON.parse(rawValue);
    const books = Array.isArray(parsed.books) ? parsed.books.map(normalizeBook) : [];

    return {
      books: books.sort((left, right) => {
        const leftTime = new Date(left.updatedAt).getTime();
        const rightTime = new Date(right.updatedAt).getTime();
        return rightTime - leftTime;
      }),
    };
  } catch (error) {
    console.error('Failed to read local workspace state:', error);
    return emptyState();
  }
}

function writeState(ownerKey, state) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey(ownerKey), JSON.stringify(state));
}

export function getWorkspaceState(ownerKey) {
  return readState(ownerKey);
}

export function getWorkspaceBook(ownerKey, textId) {
  return readState(ownerKey).books.find((book) => book.textId === textId) || null;
}

export function upsertWorkspaceBook(ownerKey, nextBookInput) {
  const state = readState(ownerKey);
  const nextBook = normalizeBook({
    ...nextBookInput,
    updatedAt: nextBookInput.updatedAt || new Date().toISOString(),
  });

  const existingIndex = state.books.findIndex((book) => book.textId === nextBook.textId);

  if (existingIndex === -1) {
    state.books.unshift(nextBook);
  } else {
    const existingBook = state.books[existingIndex];
    state.books[existingIndex] = normalizeBook({
      ...existingBook,
      ...nextBook,
      characters: nextBook.characters.length ? nextBook.characters : existingBook.characters,
      characterSessions: nextBook.characterSessions || existingBook.characterSessions,
    });
  }

  writeState(ownerKey, state);
  return getWorkspaceBook(ownerKey, nextBook.textId);
}

export function rememberSelectedCharacter(ownerKey, textId, characterId) {
  const book = getWorkspaceBook(ownerKey, textId);
  if (!book) {
    return null;
  }

  return upsertWorkspaceBook(ownerKey, {
    ...book,
    activeCharacterId: characterId,
  });
}

export function getConversationSnapshot(ownerKey, textId, characterId) {
  const book = getWorkspaceBook(ownerKey, textId);
  if (!book) {
    return null;
  }

  return book.characterSessions?.[characterId] || null;
}

export function saveConversationSnapshot(
  ownerKey,
  { textId, characterId, sessionId, messages, psiParameters, emotionState },
) {
  const book = getWorkspaceBook(ownerKey, textId);
  if (!book) {
    return null;
  }

  const nextBook = {
    ...book,
    activeCharacterId: characterId,
    characterSessions: {
      ...(book.characterSessions || {}),
      [characterId]: {
        sessionId,
        messages,
        psiParameters,
        emotionState,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  return upsertWorkspaceBook(ownerKey, nextBook);
}
