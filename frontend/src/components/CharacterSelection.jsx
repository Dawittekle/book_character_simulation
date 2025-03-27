import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CharacterSelection.css';

function CharacterSelection() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get characters from localStorage
    const storedCharacters = localStorage.getItem('characters');
    
    if (storedCharacters) {
      setCharacters(JSON.parse(storedCharacters));
    } else {
      // If no characters found, redirect to upload page
      navigate('/');
    }
  }, [navigate]);

  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character);
  };

  const handleStartChat = () => {
    if (selectedCharacter) {
      // Store selected character and text_id in localStorage for the chat component
      localStorage.setItem('selectedCharacter', JSON.stringify(selectedCharacter));
      navigate(`/chat/${selectedCharacter.id}`);
    }
  };

  const handleBackToUpload = () => {
    navigate('/');
  };

  return (
    <div className="character-selection-container">
      <h2>Select a Character</h2>
      <p>Choose a character to start a conversation</p>
      
      {characters.length === 0 ? (
        <div className="no-characters">
          <p>No characters found. Please upload a text or PDF file.</p>
          <button onClick={handleBackToUpload}>Back to Upload</button>
        </div>
      ) : (
        <>
          <div className="characters-grid">
            {characters.map((character) => (
              <div 
                key={character.id}
                className={`character-card ${selectedCharacter?.id === character.id ? 'selected' : ''}`}
                onClick={() => handleCharacterSelect(character)}
              >
                <h3>{character.name}</h3>
                <p className="personality"><strong>Personality:</strong> {character.personality}</p>
                
                <div className="emotion-state-section">
                  <h4>Emotional State:</h4>
                  <div className="emotion-bars">
                    {Object.entries(character.emotion_state).map(([emotion, value]) => (
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
                
                <div className="psi-parameters-section">
                  <h4>Psychological Parameters:</h4>
                  <div className="psi-parameters-grid">
                    {Object.entries(character.psi_parameters).map(([param, value]) => (
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
                
                {selectedCharacter?.id === character.id && (
                  <div className="character-details">
                    {character.relationships && character.relationships.length > 0 && (
                      <div className="relationships-section">
                        <h4>Relationships:</h4>
                        <ul className="relationships-list">
                          {character.relationships.map((relationship, index) => (
                            <li key={index}>{relationship}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {character.key_events && character.key_events.length > 0 && (
                      <div className="key-events-section">
                        <h4>Key Events:</h4>
                        <ul className="key-events-list">
                          {character.key_events.map((event, index) => (
                            <li key={index}>{event}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="character-selection-actions">
            <button 
              className="back-button"
              onClick={handleBackToUpload}
            >
              Back to Upload
            </button>
            
            <button 
              className="start-chat-button"
              disabled={!selectedCharacter}
              onClick={handleStartChat}
            >
              {selectedCharacter 
                ? `Start Chat with ${selectedCharacter.name}` 
                : 'Select a Character'}
            </button>
          </div>
        </>
      )}
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

export default CharacterSelection;