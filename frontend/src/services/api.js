const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(
  /\/$/,
  '',
);

async function request(endpoint, { method = 'GET', body, accessToken } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      body,
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
      signal: controller.signal,
    });

    const payload = await response
      .json()
      .catch(() => ({ error: 'The server returned an unreadable response.' }));

    if (!response.ok) {
      throw new Error(payload.error || 'The request could not be completed.');
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const apiService = {
  extractCharacters: async ({ text, file, llmProvider, accessToken }) => {
    const formData = new FormData();

    if (file) {
      formData.append('file', file);
    } else if (text) {
      formData.append('text', text);
    }

    if (llmProvider) {
      formData.append('llm_provider', llmProvider);
    }

    return request('/extract-characters', {
      method: 'POST',
      body: formData,
      accessToken,
    });
  },

  chatWithCharacter: async ({
    characterId,
    message,
    textId,
    sessionId,
    llmProvider,
    accessToken,
  }) => {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('text_id', textId);

    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    if (llmProvider) {
      formData.append('llm_provider', llmProvider);
    }

    const response = await request(`/chat/${characterId}`, {
      method: 'POST',
      body: formData,
      accessToken,
    });

    if (Array.isArray(response)) {
      return response[0];
    }

    return response;
  },
};

export default apiService;
