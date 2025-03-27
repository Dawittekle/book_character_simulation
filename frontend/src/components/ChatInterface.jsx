import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './ChatInterface.css';

function ChatInterface() {
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [emotionState, setEmotionState] = useState(null);
  const [psiParameters, setPsiParameters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { characterId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const textId = useRef('');

  // Load character data from localStorage
  useEffect(() => {
    const storedCharacter = localStorage.getItem('selectedCharacter');
    const storedCharacters = localStorage.getItem('characters');
    
    if (storedCharacter) {
      const parsedCharacter = JSON.parse(storedCharacter);
      setCharacter(parsedCharacter);
      setEmotionState(parsedCharacter.emotion_state);
      setPsiParameters(parsedCharacter.psi_parameters);
      textId.current = parsedCharacter.text_id;
    } else if (storedCharacters) {
      // If no selected character but we have characters list, find by ID
      const parsedCharacters = JSON.parse(storedCharacters);
      const foundCharacter = parsedCharacters.find(c => c.id === characterId);
      
      if (foundCharacter) {
        setCharacter(foundCharacter);
        setEmotionState(foundCharacter.emotion_state);
        setPsiParameters(foundCharacter.psi_parameters);
        textId.current = foundCharacter.text_id;
      } else {
        setError('Character not found');
        setTimeout(() => navigate('/characters'), 3000);
      }
    } else {
      setError('No character data found');
      setTimeout(() => navigate('/'), 3000);
    }
  }, [characterId, navigate]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || loading) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to chat
    setMessages(prevMessages => [
      ...prevMessages, 
      { type: 'user', content: userMessage }
    ]);
    
    setLoading(true);
    
    // Inside handleSendMessage function
    try {
      // Create form data for the request
      const formData = new FormData();
      formData.append('message', userMessage);
      formData.append('text_id', textId.current);
      
      if (sessionId) {
        formData.append('session_id', sessionId);
      }
      
      const responseData = await apiService.chatWithCharacter(
        characterId,
        userMessage,
        textId.current,
        sessionId
      );
      
      setSessionId(responseData[0].session_id);
      
      setPsiParameters(responseData[0].updated_psi);
      setEmotionState(responseData[0].emotion_state);
      
      setMessages(prevMessages => [
        ...prevMessages,
        { type: 'ai', content: responseData[0].reply }
      ]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!character) {
    return <div className="loading">Loading character data...</div>;
  }

  return (
    <div className="chat-interface-container">
      <div className="chat-header">
        <button 
          className="back-button"
          onClick={() => navigate('/characters')}
        >
          Back to Characters
        </button>
        <h2>Conversation with {character.name}</h2>
      </div>
      
      <div className="chat-content">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-chat-message">
              Start a conversation with {character.name}
            </div>
          ) : (
            messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.type === 'user' ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-content">{message.content}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
          
          {loading && (
            <div className="ai-typing">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>
        
        <div className="character-state-panel">
          <div className="character-info">
            <h3>{character.name}</h3>
            <p className="personality">{character.personality}</p>
          </div>
          
          {emotionState && (
            <div className="emotion-state-section">
              <h4>Emotional State:</h4>
              <div className="emotion-bars">
                {Object.entries(emotionState).map(([emotion, value]) => (
                  <div key={emotion} className="emotion-bar-container">
                    <span className="emotion-label">{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
                    <div className="emotion-bar-bg">
                      <div 
                        className="emotion-bar-fill" 
                        style={{ 
                          width: `${value * 100}%`,
                          backgroundColor: getEmotionColor(emotion)
                        }}
                      ></div>
                    </div>
                    <span className="emotion-value">{(value * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {psiParameters && (
            <div className="psi-parameters-section">
              <h4>Psychological Parameters:</h4>
              <div className="psi-parameters-grid">
                {Object.entries(psiParameters).map(([param, value]) => (
                  <div key={param} className="psi-parameter">
                    <span className="psi-parameter-label">{formatParameterName(param)}</span>
                    <div className="psi-parameter-bar-bg">
                      <div 
                        className="psi-parameter-bar-fill" 
                        style={{ 
                          width: `${value * 100}%`,
                          backgroundColor: '#3498db'
                        }}
                      ></div>
                    </div>
                    <span className="psi-parameter-value">{(value * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={!inputMessage.trim() || loading}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Helper function to format parameter names
function formatParameterName(name) {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to get color for each emotion
function getEmotionColor(emotion) {
  const colors = {
    anger: '#FF5252',
    sadness: '#536DFE',
    pride: '#FFD740',
    joy: '#66BB6A',
    bliss: '#26C6DA'
  };
  
  return colors[emotion] || '#9E9E9E';
}

export default ChatInterface;