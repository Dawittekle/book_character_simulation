import React, { useEffect, useState, useMemo } from 'react';
import './LorelyUploadProgress.css';

const CIRCUMFERENCE = 289.03; // 2 * Math.PI * 46

const STAGES = [
  { id: 1, label: 'Uploading & reading manuscript...', minProgress: 0, maxProgress: 30 },
  { id: 2, label: 'Indexing chapters & bookshelf metadata...', minProgress: 31, maxProgress: 65 },
  { id: 3, label: 'Extracting characters & emotional profiles...', minProgress: 66, maxProgress: 99 },
  { id: 4, label: 'Ready to read & converse', minProgress: 100, maxProgress: 100 },
];

/**
 * LorelyUploadProgress Component
 *
 * Full-screen modal progress card displaying the Lorely brand mark inside
 * an active circular progress ring, dynamic stage checklist, and progress bar.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {number} [props.progress] - Progress percentage (0-100). If omitted, runs asymptotic simulation.
 * @param {string} [props.fileName='Manuscript'] - Name of uploaded document
 * @param {string} [props.statusText] - Optional backend status message override
 * @param {Function} [props.onCancel] - Optional cancel button callback
 */
export default function LorelyUploadProgress({
  isOpen = false,
  progress = null,
  fileName = 'Manuscript',
  statusText = null,
  onCancel = null,
}) {
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  // Asymptotic progress simulator when external progress is null/undefined
  useEffect(() => {
    if (!isOpen) {
      setSimulatedProgress(0);
      return;
    }

    if (progress !== null && progress !== undefined) {
      return;
    }

    let isMounted = true;
    const interval = setInterval(() => {
      if (!isMounted) return;
      setSimulatedProgress((prev) => {
        if (prev < 35) return prev + 3;
        if (prev < 70) return prev + 1.2;
        if (prev < 88) return prev + 0.6;
        if (prev < 93) return prev + 0.15;
        return prev;
      });
    }, 120);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, progress]);

  // Actual display progress
  const currentProgress = useMemo(() => {
    const raw = progress !== null && progress !== undefined ? progress : simulatedProgress;
    return Math.min(100, Math.max(0, Math.round(raw)));
  }, [progress, simulatedProgress]);

  if (!isOpen) return null;

  // Active stage determination
  const activeStageIndex = useMemo(() => {
    if (currentProgress >= 100) return 3;
    if (currentProgress >= 66) return 2;
    if (currentProgress >= 31) return 1;
    return 0;
  }, [currentProgress]);

  const activeStageLabel = statusText || STAGES[activeStageIndex].label;

  // SVG Progress Ring calculations
  const strokeDashoffset = CIRCUMFERENCE - (currentProgress / 100) * CIRCUMFERENCE;
  const dialogueGlowIntensity = (currentProgress / 100) * 14;

  return (
    <div
      className="lorely-upload-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Upload Progress"
      data-testid="lorely-upload-overlay"
    >
      <div className="lorely-upload-card" data-testid="lorely-upload-card">
        {/* Hero Progress Ring with Centered Brand Mark */}
        <div className="lorely-upload-ring-wrap" data-testid="lorely-upload-ring-wrap">
          <svg
            className="lorely-upload-ring-svg"
            width="104"
            height="104"
            viewBox="0 0 104 104"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background Circular Track */}
            <circle
              className="lorely-upload-ring-track"
              cx="52"
              cy="52"
              r="46"
              strokeWidth="3.5"
            />
            {/* Active Progress Ring */}
            <circle
              className="lorely-upload-ring-fill"
              cx="52"
              cy="52"
              r="46"
              strokeWidth="3.5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Centered V2 Brand Mark */}
          <div className="lorely-upload-center-mark">
            <svg
              width="44"
              height="44"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Left Book Spine (Scanning Shimmer) */}
              <rect
                x="15"
                y="12"
                width="11"
                height="40"
                rx="5.5"
                fill="#FAFAFA"
                className="upload-spine-left"
              />
              {/* Right Dialogue Spine (Intensity Glow with Progress) */}
              <path
                d="M32 17.5C32 14.4624 34.4624 12 37.5 12C40.5376 12 43 14.4624 43 17.5V40.5C43 46.8513 37.8513 52 31.5 52H31V41.5C31 38.4624 32 35.5 32 32V17.5Z"
                fill="#EA580C"
                className="upload-spine-right"
                style={{
                  filter: `drop-shadow(0 0 ${dialogueGlowIntensity}px rgba(234, 88, 12, 0.75))`,
                  opacity: 0.85 + (currentProgress / 100) * 0.15,
                }}
              />
            </svg>
          </div>
        </div>

        {/* File Name & Active Stage Subtitle */}
        <h3 className="lorely-upload-filename" title={fileName} data-testid="lorely-upload-filename">
          {fileName}
        </h3>
        <p className="lorely-upload-stage-label" data-testid="lorely-upload-stage-label">
          {activeStageLabel}
        </p>

        {/* Linear Progress Bar with Bold Tabular Readout */}
        <div className="lorely-upload-bar-group">
          <div className="lorely-upload-bar-track">
            <div
              className="lorely-upload-bar-fill"
              style={{ width: `${currentProgress}%` }}
              data-testid="lorely-upload-bar-fill"
            />
          </div>
          <div className="lorely-upload-readout-row">
            <span className="lorely-upload-status-tag">
              {currentProgress >= 100 ? 'Complete' : 'Processing'}
            </span>
            <span className="lorely-upload-percentage" data-testid="lorely-upload-percentage">
              {currentProgress}%
            </span>
          </div>
        </div>

        {/* Dynamic 4-Stage Checklist */}
        <div className="lorely-upload-checklist" data-testid="lorely-upload-checklist">
          {STAGES.map((stage, idx) => {
            const isCompleted = currentProgress > stage.maxProgress || currentProgress === 100;
            const isActive = !isCompleted && idx === activeStageIndex;

            let iconClass = 'pending';
            let iconText = '○';

            if (isCompleted) {
              iconClass = 'completed';
              iconText = '✓';
            } else if (isActive) {
              iconClass = 'active';
              iconText = '●';
            }

            return (
              <div
                key={stage.id}
                className={`lorely-upload-stage-item ${isActive ? 'is-active' : ''} ${
                  isCompleted ? 'is-completed' : ''
                }`.trim()}
              >
                <span className={`lorely-stage-icon ${iconClass}`}>{iconText}</span>
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Optional Cancel Ghost Button */}
        {onCancel && (
          <button
            type="button"
            className="lorely-upload-cancel-btn"
            onClick={onCancel}
            data-testid="lorely-upload-cancel-btn"
          >
            Cancel upload
          </button>
        )}
      </div>
    </div>
  );
}
