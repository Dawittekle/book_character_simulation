import React, { useState } from 'react';
import { lorelyApi } from '../services/lorelyApi';
import { getFriendlyErrorMessage } from '../lib/errorUtils';
import BrandLogo from './brand/BrandLogo';
import PillButton from './brand/PillButton';
import BadgePill from './brand/BadgePill';
import './AddBookModal.css';

export default function AddBookModal({
  isOpen,
  onClose,
  onBookAdded,
  accessToken,
  defaultVisibility = 'private',
  isSharedCatalog = false,
}) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [visibility, setVisibility] = useState(defaultVisibility);
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
          text: tab === 'paste' ? pastedText : null,
          filename: tab === 'upload' ? file.name : 'pasted_story.txt',
        },
        accessToken,
      );

      setInspectionResult(inspectData);
      setCustomTitle(inspectData.title || '');
      setCustomAuthor(inspectData.author || '');
      setStep('review');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
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
          visibility,
          forceExtraction,
        },
        accessToken,
      );

      if (onBookAdded) {
        onBookAdded(ingestData.book || ingestData);
      }
      onClose();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
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
    <div className="add-book-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-book-modal-title">
      <div className="add-book-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-brand-badge">
              <BrandLogo size="sm" showTagline={false} showText={false} />
            </div>
            <div>
              <h2 id="add-book-modal-title" className="modal-title">
                {isSharedCatalog ? 'Add Book to Shared Catalog' : 'Add a Book to Your Library'}
              </h2>
              <span className="modal-subtitle">
                {isSharedCatalog ? 'Featured & vector-indexed catalog' : 'Import manuscript, novella, or classic story'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={resetForm}
            aria-label="Close modal"
          >
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
                    <div className="dropzone-icon-bubble">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span className="dropzone-text">
                      {file ? file.name : 'Click or drop PDF, EPUB, or TXT file here'}
                    </span>
                    <span className="dropzone-sub">
                      Supports classic novels, short stories, and manuscripts
                    </span>
                    {file && (
                      <span className="dropzone-file-tag">
                        Selected: {(file.size / 1024).toFixed(1)} KB
                      </span>
                    )}
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
                <PillButton variant="ghost" size="md" onClick={resetForm}>
                  Cancel
                </PillButton>
                <PillButton
                  variant="orange"
                  size="md"
                  hasChevron
                  onClick={handleInspect}
                  disabled={tab === 'upload' ? !file : !pastedText.trim()}
                >
                  Inspect & Classify →
                </PillButton>
              </div>
            </div>
          )}

          {step === 'inspecting' && (
            <div className="modal-loading-step">
              <div className="modal-spinner-flower">
                <BrandLogo size="lg" showTagline={false} showText={false} />
              </div>
              <h3 className="loading-heading">Analyzing Manuscript</h3>
              <p className="loading-text">
                Analyzing narrative content, chapter structures, and detecting characters...
              </p>
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
                  <label htmlFor="inspect-title-input">Title</label>
                  <input
                    id="inspect-title-input"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Book Title"
                    className="summary-input"
                  />
                </div>
                <div className="summary-field">
                  <label htmlFor="inspect-author-input">Author</label>
                  <input
                    id="inspect-author-input"
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    placeholder="Author Name"
                    className="summary-input"
                  />
                </div>
                <div className="summary-field">
                  <label htmlFor="inspect-visibility-select">Catalog Visibility</label>
                  <select
                    id="inspect-visibility-select"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="summary-input"
                  >
                    <option value="featured">Featured Masterpiece (Shared with all readers & Home)</option>
                    <option value="public">Public (Shared across all library readers)</option>
                    <option value="private">Private (Restricted to my personal shelf)</option>
                  </select>
                </div>
                <div className="summary-pills-row">
                  <BadgePill variant="muted" dotColor={null}>
                    Format: {inspectionResult.format?.toUpperCase()}
                  </BadgePill>
                  <BadgePill variant="muted" dotColor={null}>
                    Words: {inspectionResult.word_count?.toLocaleString()}
                  </BadgePill>
                  <BadgePill variant="muted" dotColor={null}>
                    Pages: {inspectionResult.page_count}
                  </BadgePill>
                  <BadgePill variant="muted" dotColor={null}>
                    Type: {inspectionResult.document_type}
                  </BadgePill>
                </div>
              </div>

              <div className="modal-actions">
                <PillButton variant="ghost" size="md" onClick={() => setStep('select')}>
                  Back
                </PillButton>
                <PillButton
                  variant="orange"
                  size="md"
                  hasChevron
                  onClick={handleConfirmIngest}
                  disabled={inspectionResult.document_type === 'document' && !forceExtraction}
                >
                  Confirm & Ingest Book →
                </PillButton>
              </div>
            </div>
          )}

          {step === 'ingesting' && (
            <div className="modal-loading-step">
              <div className="modal-spinner-flower is-pulsing">
                <BrandLogo size="lg" showTagline={false} showText={false} />
              </div>
              <h3 className="loading-heading">Building Neural Embeddings</h3>
              <p className="loading-text">
                Building semantic chunks, vector embeddings, and extracting character cast...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
