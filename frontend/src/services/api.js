const API_URL = 'http://localhost:5000/api';

const apiService = {
  // Extract characters from text or PDF
  extractCharacters: async (data) => {
    const formData = new FormData();
    
    if (data.file) {
      formData.append('file', data.file);
    } else if (data.text) {
      formData.append('text', data.text);
    }
    
    const response = await fetch(`${API_URL}/extract-characters`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to extract characters');
    }
    
    return response.json();
  },
  
  // Chat with a character
  chatWithCharacter: async (characterId, message, textId, sessionId = null) => {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('text_id', textId);
    
    if (sessionId) {
      formData.append('session_id', sessionId);
    }
    
    const response = await fetch(`${API_URL}/chat/${characterId}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send message');
    }
    
    return response.json();
  }
};

export default apiService;