import React, { useState } from 'react';
import './ReportProblemModal.css';

export default function ReportProblemModal({ isOpen, onClose }) {
  const [problemText, setProblemText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!problemText.trim()) return;

    setIsSubmitting(true);
    // Simulate sending report / feedback safely
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setProblemText('');
        onClose();
      }, 1500);
    }, 400);
  };

  return (
    <div
      className="report-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-problem-title"
      data-testid="report-problem-modal"
    >
      <div className="report-modal-card">
        <div className="report-modal-header">
          <h3 id="report-problem-title" className="report-modal-title">
            Report a problem
          </h3>
          <button
            type="button"
            className="report-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="report-modal-success" role="status">
            <span className="report-success-icon">✓</span>
            <p className="report-success-title">Thank you for letting us know</p>
            <p className="report-success-sub">
              Your feedback has been logged. Our engineering and editorial teams will review it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal-form">
            <p className="report-modal-intro">
              Please include as much detail as possible to help us reproduce and resolve the issue.
            </p>
            <textarea
              className="report-modal-textarea"
              placeholder="Briefly explain what happened, or share what went wrong during reading or character dialogue..."
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              rows={4}
              required
              autoFocus
            />
            <div className="report-modal-actions">
              <button
                type="button"
                className="report-cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="report-submit-btn"
                disabled={isSubmitting || !problemText.trim()}
              >
                {isSubmitting ? 'Sending...' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
