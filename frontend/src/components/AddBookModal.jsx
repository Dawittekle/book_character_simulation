import React, { useState } from 'react';
import { lorelyApi } from '../services/lorelyApi';
import './AddBookModal.css';

export default function AddBookModal({ isOpen, onClose, onBookAdded, accessToken }) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [forceExtraction, setForceExtraction] = useState(false);

  // Inspection & ingestion state
  const [step, setStep] = useState('select'); // 'select' | 'inspecting' | 'review' | 'ingesting'
  const [inspectionResult, setInspectionResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleInspect = async () => {
    setError(null);
    if (tab === 'upload' && !file) {
      setError('Please select a book file (.pdf, .epub, .txt) to inspect.');
      return;
    }
    if (tab === 'paste' && !pastedText.trim()) {
      setError('Please paste the book or story text to inspect.');
      return;
    }

    try {
      setStep('inspecting');
      const inspectData = await lorelyApi.inspectSource(
        {
          file: tab === 'upload' ? file : null,
          rawText: tab === 'paste' ? pastedText : null,
          filename: tab === 'upload' ? file.name : 'pasted_story.txt',
        },
        accessToken,
      );

      setInspectionResult(inspectData);
      setCustomTitle(inspectData.title || '');
      setCustomAuthor(inspectData.author || '');
      setStep('review');
    } catch (err) {
      setError(err.message || 'Inspection failed.');
      setStep('select');
    }
  };

  const handleConfirmIngest = async () => {
    if (!inspectionResult) return;
    setError(null);
    setStep('ingesting');

    try {
      const ingestData = await lorelyApi.ingestSource(
        {
          tempSourceId: inspectionResult.job_id,
          title: customTitle,
          author: customAuthor,
          forceExtraction,
        },
        accessToken,
      );

      if (onBookAdded) {
        onBookAdded(ingestData.book || ingestData);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Book ingestion failed.');
      setStep('review');
    }
  };

  const resetForm = () => {
    setFile(null);
    setPastedText('');
    setCustomTitle('');
    setCustomAuthor('');
    setForceExtraction(false);
    setInspectionResult(null);
    setStep('select');
    setError(null);
    onClose();
  };

  return (
    <div className="add-book-modal-backdrop" role="dialog" aria-modal="true">
      <div className="add-book-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">📖</span>
            <h2 className="modal-title">Add a Book to Your Library</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={resetForm} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error-banner">{error}</div>}

          {step === 'select' && (
            <div className="modal-select-step">
              <div className="modal-tabs">
                <button
                  type="button"
                  className={`modal-tab ${tab === 'upload' ? 'active' : ''}`}
                  onClick={() => setTab('upload')}
                >
                  📁 Upload Document
                </button>
                <button
                  type="button"
                  className={`modal-tab ${tab === 'paste' ? 'active' : ''}`}
                  onClick={() => setTab('paste')}
                >
                  ✍️ Paste Text
                </button>
              </div>

              {tab === 'upload' ? (
                <div className="file-dropzone">
                  <input
                    type="file"
                    id="book-file-input"
                    accept=".pdf,.epub,.txt"
                    onChange={handleFileChange}
                    className="file-input-hidden"
                  />
                  <label htmlFor="book-file-input" className="file-dropzone-label">
                    <span className="dropzone-icon">📚</span>
                    <span className="dropzone-text">
                      {file ? file.name : 'Click or drop PDF, EPUB, or TXT file here'}
                    </span>
                    <span className="dropzone-sub">Supports classic novels, short stories, and manuscripts</span>
                  </label>
                </div>
              ) : (
                <div className="paste-area-wrapper">
                  <textarea
                    className="paste-textarea"
                    placeholder="Paste book chapters or story text here..."
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleInspect}
                  disabled={tab === 'upload' ? !file : !pastedText.trim()}
                >
                  Inspect & Classify →
                </button>
              </div>
            </div>
          )}

          {step === 'inspecting' && (
            <div className="modal-loading-step">
              <div className="loading-spinner" />
              <p className="loading-text">Analyzing narrative content and detecting characters...</p>
            </div>
          )}

          {step === 'review' && inspectionResult && (
            <div className="modal-review-step">
              {inspectionResult.warning && (
                <div className="document-warning-box">
                  <span className="warning-icon">⚠️</span>
                  <div className="warning-content">
                    <h4 className="warning-heading">Non-Narrative Document Detected</h4>
                    <p className="warning-desc">{inspectionResult.warning}</p>
                    <label className="force-extract-checkbox">
                      <input
                        type="checkbox"
                        checked={forceExtraction}
                        onChange={(e) => setForceExtraction(e.target.checked)}
                      />
                      <span>Force character extraction anyway</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="inspection-summary-card">
                <div className="summary-field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Book Title"
                    className="summary-input"
                  />
                </div>
                <div className="summary-field">
                  <label>Author</label>
                  <input
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    placeholder="Author Name"
                    className="summary-input"
                  />
                </div>
                <div className="summary-pills-row">
                  <span className="summary-pill">Format: {inspectionResult.format?.toUpperCase()}</span>
                  <span className="summary-pill">Words: {inspectionResult.word_count?.toLocaleString()}</span>
                  <span className="summary-pill">Pages: {inspectionResult.page_count}</span>
                  <span className="summary-pill">Type: {inspectionResult.document_type}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep('select')}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmIngest}
                  disabled={inspectionResult.document_type === 'document' && !forceExtraction}
                >
                  Confirm & Ingest Book →
                </button>
              </div>
            </div>
          )}

          {step === 'ingesting' && (
            <div className="modal-loading-step">
              <div className="loading-spinner" />
              <p className="loading-text">Building semantic chunks, vector embeddings, and extracting character cast...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
