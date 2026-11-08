const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(
  /\/api\/?$/,
  '',
);
const V1_URL = `${BASE_URL}/api/v1`;

async function request(endpoint, { method = 'GET', body, accessToken, signal } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${V1_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    throw new Error('Unable to connect to the Lorely server. Please check your network or verify the backend is running.');
  }

  const payload = await response
    .json()
    .catch(() => ({ error: 'The server returned an unreadable response.' }));

  if (!response.ok) {
    throw new Error(payload.error || 'The request could not be completed.');
  }

  return payload;
}

export const lorelyApi = {
  // User Profile & Settings
  getMe: async (accessToken) => {
    return request('/me', { accessToken });
  },

  updateMe: async ({ displayName, avatarUrl }, accessToken) => {
    return request('/me', {
      method: 'PATCH',
      body: { display_name: displayName, avatar_url: avatarUrl },
      accessToken,
    });
  },

  getSettings: async (accessToken) => {
    return request('/me/settings', { accessToken });
  },

  updateSettings: async (settings, accessToken) => {
    return request('/me/settings', {
      method: 'PATCH',
      body: settings,
      accessToken,
    });
  },

  // Books
  listBooks: async (accessToken) => {
    const res = await request('/books', { accessToken });
    return res.books || [];
  },

  createBook: async (
    { title, author, summary, coverUrl, visibility = 'private', sourceType = 'book', text },
    accessToken,
  ) => {
    return request('/books', {
      method: 'POST',
      body: {
        title,
        author,
        summary,
        cover_url: coverUrl,
        visibility,
        source_type: sourceType,
        text,
      },
      accessToken,
    });
  },

  getBookDetails: async (bookId, accessToken) => {
    return request(`/books/${bookId}`, { accessToken });
  },

  updateBook: async (bookId, updates, accessToken) => {
    return request(`/books/${bookId}`, {
      method: 'PATCH',
      body: updates,
      accessToken,
    });
  },

  deleteBook: async (bookId, accessToken) => {
    return request(`/books/${bookId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  listBookCharacters: async (bookId, accessToken) => {
    const res = await request(`/books/${bookId}/characters`, { accessToken });
    return res.characters || [];
  },

  // Characters
  getCharacterDossier: async (characterId, accessToken) => {
    return request(`/characters/${characterId}`, { accessToken });
  },

  getCharacterState: async (characterId, accessToken) => {
    return request(`/characters/${characterId}/state`, { accessToken });
  },

  resetCharacterState: async (characterId, accessToken) => {
    return request(`/characters/${characterId}/reset-state`, {
      method: 'POST',
      accessToken,
    });
  },

  getCharacterMemories: async (characterId, accessToken) => {
    const res = await request(`/characters/${characterId}/memories`, { accessToken });
    return res.memories || [];
  },

  // Conversations
  listConversations: async ({ bookId, characterId } = {}, accessToken) => {
    const params = new URLSearchParams();
    if (bookId) params.append('book_id', bookId);
    if (characterId) params.append('character_id', characterId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/conversations${queryString}`, { accessToken });
    return res.conversations || [];
  },

  createConversation: async (characterId, { title, spoilerPolicy = 'cautious' } = {}, accessToken) => {
    return request(`/characters/${characterId}/conversations`, {
      method: 'POST',
      body: { title, spoiler_policy: spoilerPolicy },
      accessToken,
    });
  },

  getConversationMessages: async (sessionId, accessToken) => {
    const res = await request(`/conversations/${sessionId}/messages`, { accessToken });
    return res.messages || [];
  },

  sendConversationMessage: async (
    sessionId,
    { content, inputModality = 'text', llmProvider },
    accessToken,
  ) => {
    return request(`/conversations/${sessionId}/messages`, {
      method: 'POST',
      body: {
        content,
        input_modality: inputModality,
        llm_provider: llmProvider,
      },
      accessToken,
    });
  },

  deleteConversation: async (sessionId, accessToken) => {
    return request(`/conversations/${sessionId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  // Voice & Audio Methods
  getMessageAudioUrl: (sessionId, messageId) => {
    return `${V1_URL}/conversations/${sessionId}/messages/${messageId}/audio`;
  },

  fetchMessageAudio: async (sessionId, messageId, accessToken) => {
    const headers = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const response = await fetch(`${V1_URL}/conversations/${sessionId}/messages/${messageId}/audio`, {
      headers,
    });
    if (!response.ok) throw new Error('Audio retrieval failed');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  sendVoiceTurn: async (sessionId, { speechText, audioBlob, llmProvider } = {}, accessToken) => {
    const headers = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    if (audioBlob) {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.wav');
      if (speechText) formData.append('speech_text', speechText);
      if (llmProvider) formData.append('llm_provider', llmProvider);

      const response = await fetch(`${V1_URL}/conversations/${sessionId}/voice-turn`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Voice turn failed');
      return data;
    }

    return request(`/conversations/${sessionId}/voice-turn`, {
      method: 'POST',
      body: {
        speech_text: speechText,
        llm_provider: llmProvider,
      },
      accessToken,
    });
  },

  // Document Ingestion & Classification Gate
  inspectSource: async ({ file, text, filename, llmProvider } = {}, accessToken) => {
    const headers = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (llmProvider) formData.append('llm_provider', llmProvider);

      let response;
      try {
        response = await fetch(`${V1_URL}/books/inspect`, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (networkErr) {
        throw new Error('Unable to connect to the Lorely server. Please check your network or verify the backend is running.');
      }
      const data = await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
      if (!response.ok) throw new Error(data.error || 'Inspection failed');
      return data;
    }

    return request('/books/inspect', {
      method: 'POST',
      body: { text, filename, llm_provider: llmProvider },
      accessToken,
    });
  },

  ingestSource: async (
    { tempSourceId, title, author, visibility = 'private', forceExtraction = false, llmProvider },
    accessToken,
  ) => {
    return request('/books/ingest', {
      method: 'POST',
      body: {
        temp_source_id: tempSourceId,
        title,
        author,
        visibility,
        force_extraction: forceExtraction,
        llm_provider: llmProvider,
      },
      accessToken,
    });
  },

  getJobStatus: async (jobId, accessToken) => {
    return request(`/jobs/${jobId}`, { accessToken });
  },

  // Authoritative Administrator Operations
  getAdminOverview: async (accessToken) => {
    return request('/admin/overview', { accessToken });
  },

  adminListJobs: async (status = null, accessToken) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await request(`/admin/jobs${query}`, { accessToken });
    return res.jobs || [];
  },

  adminRetryJob: async (jobId, accessToken) => {
    return request(`/admin/jobs/${jobId}/retry`, {
      method: 'POST',
      accessToken,
    });
  },

  adminListBooks: async (accessToken) => {
    const res = await request('/admin/books', { accessToken });
    return res.books || [];
  },

  adminUpdateBook: async (bookId, updates, accessToken) => {
    return request(`/admin/books/${bookId}`, {
      method: 'PATCH',
      body: updates,
      accessToken,
    });
  },

  adminListUsers: async (accessToken) => {
    const res = await request('/admin/users', { accessToken });
    return res.users || [];
  },

  adminUpdateUserRole: async (userId, role, accessToken) => {
    return request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
      accessToken,
    });
  },

  switchRole: async (role, accessToken) => {
    return request('/auth/switch-role', {
      method: 'POST',
      body: { role },
      accessToken,
    });
  },

  adminGetPlans: async (accessToken) => {
    return request('/admin/plans', { accessToken });
  },

  adminUpdateUserPlan: async (userId, planTier, accessToken) => {
    return request(`/admin/users/${userId}/plan`, {
      method: 'PATCH',
      body: { plan_tier: planTier },
      accessToken,
    });
  },
};

export default lorelyApi;
