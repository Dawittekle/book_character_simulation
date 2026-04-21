import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UploadModal.css';
import apiService from '../services/api';
import { deriveWorkspaceTitle, truncateText } from '../lib/formatters';
import { upsertWorkspaceBook } from '../lib/workspaceStore';

export default function UploadModal({ isOpen, onClose, ownerKey, session, onWorkspaceChanged }) {
  const [entryMode, setEntryMode] = useState('text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('server_default');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please upload a PDF file for document import.');
      return;
    }
    setErrorMessage('');
    setFile(selectedFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (entryMode === 'text' && !text.trim()) {
      setErrorMessage('Paste a story excerpt before extracting characters.');
      return;
    }

    if (entryMode === 'pdf' && !file) {
      setErrorMessage('Choose a PDF file before extracting characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const characters = await apiService.extractCharacters({
        text: entryMode === 'text' ? text.trim() : undefined,
        file: entryMode === 'pdf' ? file : undefined,
        llmProvider: provider === 'server_default' ? undefined : provider,
        accessToken: session.access_token,
      });

      if (!Array.isArray(characters) || characters.length === 0) {
        throw new Error('The backend did not return any characters. Try a richer excerpt.');
      }

      const textId = characters[0].text_id;

      upsertWorkspaceBook(ownerKey, {
        textId,
        title: deriveWorkspaceTitle({ title, text, fileName: file?.name }),
        preview: entryMode === 'text' ? truncateText(text.trim(), 240) : `Imported from ${file?.name}`,
        sourceType: entryMode,
        sourceLabel: entryMode === 'pdf' ? file?.name : 'Pasted manuscript excerpt',
        preferredProvider: provider,
        characters,
      });

      onWorkspaceChanged();
      onClose();
      navigate(`/workspace/${textId}`);
    } catch (error) {
      setErrorMessage(error.message || 'Character extraction failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="upload-modal-overlay">
      <div className="upload-modal surface-card">
        <header className="upload-modal-header">
          <h2>New book workspace</h2>
          <button className="ghost-button icon-button" onClick={onClose} type="button">✕</button>
        </header>

        <form className="composer-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="alert-banner">{errorMessage}</div>}

          <div className="composer-mode-switch">
            <button
              type="button"
              className={entryMode === 'text' ? 'mode-chip is-active' : 'mode-chip'}
              onClick={() => setEntryMode('text')}
            >
              Paste text
            </button>
            <button
              type="button"
              className={entryMode === 'pdf' ? 'mode-chip is-active' : 'mode-chip'}
              onClick={() => setEntryMode('pdf')}
            >
              Upload PDF
            </button>
          </div>

          <div className="composer-fields">
            <label>
              <span className="field-label">Workspace title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" />
            </label>

            {entryMode === 'text' ? (
              <label>
                <span className="field-label">Story excerpt</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the story..." />
              </label>
            ) : (
              <label className="file-dropzone">
                <span className="field-label">PDF document</span>
                <input accept="application/pdf" onChange={handleFileChange} type="file" />
                <span className="file-dropzone-copy">{file ? file.name : 'Choose a PDF'}</span>
              </label>
            )}

            <label>
              <span className="field-label">Model provider</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="server_default">Use server default</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
          </div>

          <div className="composer-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Extracting characters...' : 'Create character board'}
            </button>
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
