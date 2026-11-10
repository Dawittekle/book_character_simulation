const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(
  /\/api\/?$/,
  '',
);
const V1_URL = `${BASE_URL}/api/v1`;

/**
 * Resolves an avatar URL into an absolute URL accessible by the browser.
 * Handles null/undefined, absolute URLs (http/https/data/blob), and relative storage paths.
 */
export function resolveAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${BASE_URL}${cleanPath}`;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const resolvedAvatar = resolveAvatarUrl(profile.avatar_url);
  if (!resolvedAvatar) return profile;
  return {
    ...profile,
    avatar_url: resolvedAvatar,
  };
}

async function request(endpoint, { method = 'GET', body, accessToken, signal } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${V1_URL}${endpoint}`, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
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
    const res = await request('/me', { accessToken });
    return normalizeProfile(res);
  },

  updateMe: async (updates, accessToken) => {
    const res = await request('/me', {
      method: 'PATCH',
      body: {
        display_name: updates?.displayName ?? updates?.display_name,
        avatar_url: updates?.avatarUrl ?? updates?.avatar_url,
        full_name: updates?.fullName ?? updates?.full_name,
        preferred_language: updates?.preferredLanguage ?? updates?.preferred_language,
      },
      accessToken,
    });
    return normalizeProfile(res);
  },

  uploadAvatar: async (fileOrBlob, accessToken) => {
    const formData = new FormData();
    formData.append('avatar', fileOrBlob);
    const res = await request('/me/avatar', {
      method: 'POST',
      body: formData,
      accessToken,
    });
    return {
      ...res,
      avatar_url: resolveAvatarUrl(res.avatar_url),
      profile: normalizeProfile(res.profile),
    };
  },

  deleteAvatar: async (accessToken) => {
    const res = await request('/me/avatar', {
      method: 'DELETE',
      accessToken,
    });
    return {
      ...res,
      profile: normalizeProfile(res.profile),
    };
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

  getMySubscription: async (accessToken) => {
    return request('/me/subscription', { accessToken });
  },

  // Books
  listBooks: async (accessTokenOrScope, maybeAccessToken) => {
    let scope;
    let accessToken = maybeAccessToken;
    if (typeof accessTokenOrScope === 'string' && ['all', 'mine', 'featured'].includes(accessTokenOrScope)) {
      scope = accessTokenOrScope;
    } else {
      accessToken = accessTokenOrScope;
    }
    const query = scope ? `?scope=${scope}` : '';
    const res = await request(`/books${query}`, { accessToken });
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

  listCharacters: async (bookIdOrAccessToken, maybeAccessToken) => {
    let bookId = typeof bookIdOrAccessToken === 'string' && !bookIdOrAccessToken.startsWith('eyJ') ? bookIdOrAccessToken : undefined;
    let token = bookId ? maybeAccessToken : bookIdOrAccessToken;
    const url = bookId ? `/characters?book_id=${encodeURIComponent(bookId)}` : '/characters';
    const res = await request(url, { accessToken: token });
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

  deleteCharacterMemory: async (characterId, memoryId, accessToken) => {
    return request(`/characters/${characterId}/memories/${memoryId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  updateCharacterMemory: async (characterId, memoryId, fact, accessToken) => {
    return request(`/characters/${characterId}/memories/${memoryId}`, {
      method: 'PATCH',
      body: { fact },
      accessToken,
    });
  },

  // Conversations
  listConversations: async (filterOrToken = {}, maybeToken) => {
    let bookId;
    let characterId;
    let accessToken = maybeToken;

    if (typeof filterOrToken === 'string') {
      accessToken = filterOrToken;
    } else if (typeof filterOrToken === 'object' && filterOrToken !== null) {
      bookId = filterOrToken.bookId || filterOrToken.book_id;
      characterId = filterOrToken.characterId || filterOrToken.character_id;
    }

    const params = new URLSearchParams();
    if (bookId) params.append('book_id', bookId);
    if (characterId) params.append('character_id', characterId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/conversations${queryString}`, { accessToken });
    return res.conversations || [];
  },

  createConversation: async (characterIdOrParams, optionsOrToken, maybeToken) => {
    let charId;
    let title;
    let spoilerPolicy = 'cautious';
    let token;

    if (typeof characterIdOrParams === 'object' && characterIdOrParams !== null) {
      charId = characterIdOrParams.characterId || characterIdOrParams.character_id;
      title = characterIdOrParams.title;
      spoilerPolicy = characterIdOrParams.spoilerPolicy || characterIdOrParams.spoiler_policy || 'cautious';
      token = optionsOrToken;
    } else {
      charId = characterIdOrParams;
      title = optionsOrToken?.title;
      spoilerPolicy = optionsOrToken?.spoilerPolicy || optionsOrToken?.spoiler_policy || 'cautious';
      token = maybeToken;
    }

    return request(`/characters/${charId}/conversations`, {
      method: 'POST',
      body: { title, spoiler_policy: spoilerPolicy },
      accessToken: token,
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

  interruptConversation: async (sessionId, accessToken) => {
    return request(`/conversations/${sessionId}/interrupt`, {
      method: 'POST',
      accessToken,
    });
  },

  listVoices: async ({ provider, gender, language } = {}, accessToken) => {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (gender) params.append('gender', gender);
    if (language) params.append('language', language);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/voices${queryString}`, { accessToken });
  },

  getVoicePreviewUrl: (voiceId) => {
    return `${V1_URL}/voices/${voiceId}/preview`;
  },

  getMatchedVoice: async (characterId, { language = 'en' } = {}, accessToken) => {
    return request(`/characters/${characterId}/matched-voice?language=${encodeURIComponent(language)}`, {
      accessToken,
    });
  },

  getVoiceUsage: async (accessToken) => {
    return request('/me/voice-usage', { accessToken });
  },

  // Real-time Voice (Phase 6)
  createRealtimeSession: async (sessionId, { voiceOverride } = {}, accessToken) => {
    return request(`/conversations/${sessionId}/realtime-session`, {
      method: 'POST',
      body: { voice_override: voiceOverride },
      accessToken,
    });
  },

  executeRealtimeToolCall: async (sessionId, { readerMessage } = {}, accessToken) => {
    return request(`/conversations/${sessionId}/realtime-tool-call`, {
      method: 'POST',
      body: { reader_message: readerMessage },
      accessToken,
    });
  },

  getVoiceBenchmark: async () => {
    return request('/voice/benchmark');
  },

  // Reusable Avatar Library (Phase 7)
  listAvatars: async ({ gender, artStyle, periodEra } = {}) => {
    const params = new URLSearchParams();
    if (gender) params.append('gender', gender);
    if (artStyle) params.append('art_style', artStyle);
    if (periodEra) params.append('period_era', periodEra);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/avatars${queryString}`);
  },

  getMatchedAvatar: async (characterId, accessToken) => {
    return request(`/characters/${characterId}/matched-avatar`, { accessToken });
  },

  updateCharacterAvatar: async (characterId, avatarAssetId, accessToken) => {
    return request(`/characters/${characterId}/avatar`, {
      method: 'PATCH',
      body: { avatar_asset_id: avatarAssetId },
      accessToken,
    });
  },

  // Public Featured Catalogue (Phase 7)
  listFeaturedCatalog: async ({ language, genre } = {}) => {
    const params = new URLSearchParams();
    if (language) params.append('language', language);
    if (genre) params.append('genre', genre);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request(`/catalog/featured${queryString}`);
  },

  addCatalogBookToLibrary: async (bookId, { readingProgressChapter = 1 } = {}, accessToken) => {
    return request(`/catalog/books/${bookId}/add-to-library`, {
      method: 'POST',
      body: { reading_progress_chapter: readingProgressChapter },
      accessToken,
    });
  },

  adminPublishCatalogBook: async (bookId, data, accessToken) => {
    return request(`/admin/books/${bookId}/publish`, {
      method: 'PATCH',
      body: data,
      accessToken,
    });
  },

  // Privacy & Data Portability (Phase 7)
  exportAccountData: async (accessToken) => {
    return request('/me/export', { accessToken });
  },

  deleteAccount: async (accessToken) => {
    return request('/me', {
      method: 'DELETE',
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

  migrateLegacyWorkspace: async (payload, accessToken) => {
    return request('/workspaces/migrate-legacy', {
      method: 'POST',
      body: payload,
      accessToken,
    });
  },

  // Authoritative Administrator Operations
  adminLogin: async ({ email, password }) => {
    const res = await request('/admin/login', {
      method: 'POST',
      body: { email, password },
    });
    if (res.token) {
      localStorage.setItem('lorely_admin_token', res.token);
      if (res.user) {
        localStorage.setItem('lorely_admin_user', JSON.stringify(res.user));
      }
    }
    return res;
  },

  getStoredAdminToken: () => {
    return localStorage.getItem('lorely_admin_token');
  },

  getStoredAdminUser: () => {
    try {
      const u = localStorage.getItem('lorely_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  adminLogout: () => {
    localStorage.removeItem('lorely_admin_token');
    localStorage.removeItem('lorely_admin_user');
  },

  getAdminOverview: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request('/admin/overview', { accessToken: token });
  },

  adminListJobs: async (status = null, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await request(`/admin/jobs${query}`, { accessToken: token });
    return res.jobs || [];
  },

  adminRetryJob: async (jobId, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/jobs/${jobId}/retry`, {
      method: 'POST',
      accessToken: token,
    });
  },

  getAdminAnalytics: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request('/admin/analytics', { accessToken: token });
  },

  adminListBooks: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    const res = await request('/admin/books', { accessToken: token });
    return res.books || [];
  },

  adminUpdateBook: async (bookId, updates, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/books/${bookId}`, {
      method: 'PATCH',
      body: updates,
      accessToken: token,
    });
  },

  adminListUsers: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    const res = await request('/admin/users', { accessToken: token });
    return res.users || [];
  },

  adminUpdateUserRole: async (userId, role, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
      accessToken: token,
    });
  },

  adminDeleteUser: async (userId, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/users/${userId}`, {
      method: 'DELETE',
      accessToken: token,
    });
  },

  switchRole: async (role, accessToken) => {
    return request('/auth/switch-role', {
      method: 'POST',
      body: { role },
      accessToken,
    });
  },

  getPlans: async (accessToken) => {
    return request('/plans', { accessToken });
  },

  getPaymentConfig: async (accessToken) => {
    const res = await request('/payments/config', { accessToken });
    return res.config || {};
  },

  adminUpdatePaymentConfig: async (payload, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    const res = await request('/admin/payments/config', {
      method: 'PUT',
      body: payload,
      accessToken: token,
    });
    return res.config || {};
  },

  submitPayment: async (payload, accessToken) => {
    return request('/payments/submit', {
      method: 'POST',
      body: payload,
      accessToken,
    });
  },

  adminGetPlans: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request('/admin/plans', { accessToken: token });
  },

  adminUpdatePlan: async (planId, payload, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/plans/${encodeURIComponent(planId)}`, {
      method: 'PUT',
      body: payload,
      accessToken: token,
    });
  },

  adminUpdateUserPlan: async (userId, planTier, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/users/${userId}/plan`, {
      method: 'PATCH',
      body: { plan_tier: planTier },
      accessToken: token,
    });
  },

  adminListPayments: async (statusFilter, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await request(`/admin/payments${query}`, { accessToken: token });
    return res.payments || [];
  },

  adminVerifyPayment: async (paymentId, adminNotes, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/payments/${encodeURIComponent(paymentId)}/verify`, {
      method: 'POST',
      body: { admin_notes: adminNotes },
      accessToken: token,
    });
  },

  adminRejectPayment: async (paymentId, adminNotes, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request(`/admin/payments/${encodeURIComponent(paymentId)}/reject`, {
      method: 'POST',
      body: { admin_notes: adminNotes },
      accessToken: token,
    });
  },

  adminGetSubscribers: async (accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request('/admin/subscribers', { accessToken: token });
  },

  listNotifications: async (accessToken) => {
    const res = await request('/notifications', { accessToken });
    return res.notifications || [];
  },

  markNotificationRead: async (notificationId, accessToken) => {
    return request(`/notifications/${notificationId}/read`, {
      method: 'POST',
      accessToken,
    });
  },

  markAllNotificationsRead: async (accessToken) => {
    return request('/notifications/read-all', {
      method: 'POST',
      accessToken,
    });
  },

  adminBroadcastNotification: async (data, accessToken) => {
    const token = accessToken || lorelyApi.getStoredAdminToken();
    return request('/admin/notifications/broadcast', {
      method: 'POST',
      body: data,
      accessToken: token,
    });
  },

  // Reader Engine APIs
  getReaderAccess: async (bookId, accessToken) => {
    return request(`/reader/books/${bookId}/access`, { accessToken });
  },

  getReaderChapters: async (bookId, accessToken) => {
    return request(`/reader/books/${bookId}/chapters`, { accessToken });
  },

  getReaderRawSourceUrl: (bookId) => {
    return `${V1_URL}/reader/books/${bookId}/raw`;
  },

  updateReaderProgress: async (bookId, progressData, accessToken) => {
    return request(`/reader/books/${bookId}/progress`, {
      method: 'PUT',
      body: progressData,
      accessToken,
    });
  },

  getReaderProgress: async (bookId, accessToken) => {
    return request(`/reader/books/${bookId}/progress`, { accessToken });
  },

  getChapterNarration: async (bookId, chapterIndex, options = {}, accessToken) => {
    const params = new URLSearchParams();
    if (options.voiceId) params.append('voice_id', options.voiceId);
    if (options.speed) params.append('speed', options.speed.toString());
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return request(`/reader/books/${bookId}/narration/${chapterIndex}${queryStr}`, { accessToken });
  },

  // Reader Bookmarks
  getReaderBookmarks: async (bookId, accessToken) => {
    const res = await request(`/reader/books/${bookId}/bookmarks`, { accessToken });
    return res.bookmarks || [];
  },

  createReaderBookmark: async (bookId, bookmarkData, accessToken) => {
    const res = await request(`/reader/books/${bookId}/bookmarks`, {
      method: 'POST',
      body: bookmarkData,
      accessToken,
    });
    return res.bookmark;
  },

  deleteReaderBookmark: async (bookId, bookmarkId, accessToken) => {
    return request(`/reader/books/${bookId}/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  // Reader Annotations & Highlights
  getReaderAnnotations: async (bookId, accessToken) => {
    const res = await request(`/reader/books/${bookId}/annotations`, { accessToken });
    return res.annotations || [];
  },

  createReaderAnnotation: async (bookId, annotationData, accessToken) => {
    const res = await request(`/reader/books/${bookId}/annotations`, {
      method: 'POST',
      body: annotationData,
      accessToken,
    });
    return res.annotation;
  },

  deleteReaderAnnotation: async (bookId, annotationId, accessToken) => {
    return request(`/reader/books/${bookId}/annotations/${annotationId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  // Reader "Ask a Character" Contextual Chat
  sendReaderContextualChat: async (bookId, payload, accessToken) => {
    return request(`/reader/books/${bookId}/contextual-chat`, {
      method: 'POST',
      body: payload,
      accessToken,
    });
  },
};

export default lorelyApi;
