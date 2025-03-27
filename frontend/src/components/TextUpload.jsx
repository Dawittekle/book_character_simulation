import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './TextUpload.css';

function TextUpload() {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setText(''); // Clear text input when file is selected
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!text && !file) {
      setError('Please provide either text or upload a PDF file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const characters = await apiService.extractCharacters({
        text: text,
        file: file
      });
      
      // Store characters in localStorage to access them in the CharacterSelection component
      localStorage.setItem('characters', JSON.stringify(characters));
      
      navigate('/characters');
    } catch (err) {
      console.error('Error extracting characters:', err);
      setError(err.message || 'Failed to extract characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-upload-container">
      <h2>Upload Text or PDF</h2>
      <p>Enter text or upload a PDF file to extract characters</p>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="text-input">Enter Text:</label>
          <textarea
            id="text-input"
            value={text}
            onChange={handleTextChange}
            placeholder="Paste your text here..."
            disabled={loading || file !== null}
            rows={10}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="file-input">Or Upload PDF:</label>
          <input
            type="file"
            id="file-input"
            onChange={handleFileChange}
            accept="application/pdf"
            disabled={loading || text !== ''}
          />
          {file && <p className="file-name">Selected file: {file.name}</p>}
        </div>
        
        <button 
          type="submit" 
          className="submit-button"
          disabled={loading || (!text && !file)}
        >
          {loading ? 'Extracting Characters...' : 'Extract Characters'}
        </button>
      </form>
    </div>
  );
}

export default TextUpload;