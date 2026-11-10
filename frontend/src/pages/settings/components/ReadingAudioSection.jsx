import React, { useState, useEffect } from 'react';
import { BookOpen, Volume2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { READER_THEMES, FONT_FAMILIES } from '../../../components/reader/ReaderThemes';

const SPOILER_POLICIES = [
  { id: 'cautious', label: 'Cautious (Default)' },
  { id: 'strict', label: 'Strict Quarantine' },
  { id: 'unrestricted', label: 'Unrestricted Scholar' },
];

export default function ReadingAudioSection({ settings, onUpdateSettings }) {
  const [readingTheme, setReadingTheme] = useState(() => settings?.reading_theme || 'parchment');
  const [fontFamily, setFontFamily] = useState(() => settings?.preferences?.fontFamily || 'serif');
  const [fontSize, setFontSize] = useState(() => settings?.preferences?.fontSize || 18);
  const [lineHeight, setLineHeight] = useState(() => settings?.preferences?.lineHeight || 1.75);
  const [autoPlay, setAutoPlay] = useState(() => settings?.voice_auto_play ?? true);
  const [vadSilenceMs, setVadSilenceMs] = useState(() => settings?.voice_vad_silence_ms ?? 1200);
  const [saveRecordings, setSaveRecordings] = useState(() => settings?.voice_save_audio_recordings ?? false);
  const [spoilerPolicy, setSpoilerPolicy] = useState(() => settings?.spoiler_policy || 'cautious');
  const [savingStatus, setSavingStatus] = useState(null);

  useEffect(() => {
    if (settings) {
      if (settings.reading_theme) setReadingTheme(settings.reading_theme);
      if (settings.preferences?.fontFamily) setFontFamily(settings.preferences.fontFamily);
      if (settings.preferences?.fontSize) setFontSize(settings.preferences.fontSize);
      if (settings.preferences?.lineHeight) setLineHeight(settings.preferences.lineHeight);
      if (typeof settings.voice_auto_play === 'boolean') setAutoPlay(settings.voice_auto_play);
      if (typeof settings.voice_vad_silence_ms === 'number') setVadSilenceMs(settings.voice_vad_silence_ms);
      if (typeof settings.voice_save_audio_recordings === 'boolean') setSaveRecordings(settings.voice_save_audio_recordings);
      if (settings.spoiler_policy) setSpoilerPolicy(settings.spoiler_policy);
    }
  }, [settings]);

  const updateReaderLocalStorage = (patch) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('lorely_reader_settings');
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem('lorely_reader_settings', JSON.stringify({ ...current, ...patch }));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const handleUpdate = async (patch, localReaderPatch = {}) => {
    setSavingStatus('saving');
    updateReaderLocalStorage(localReaderPatch);
    if (onUpdateSettings) {
      try {
        await onUpdateSettings(patch);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to update reading settings:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  const handleSelectTheme = (themeId) => {
    setReadingTheme(themeId);
    handleUpdate({ reading_theme: themeId }, { theme: themeId });
  };

  const handleSelectFontFamily = (familyKey) => {
    setFontFamily(familyKey);
    const nextPrefs = { ...(settings?.preferences || {}), fontFamily: familyKey, fontSize, lineHeight };
    handleUpdate({ preferences: nextPrefs }, { fontFamily: familyKey });
  };

  const handleSelectFontSize = (size) => {
    setFontSize(size);
    const nextPrefs = { ...(settings?.preferences || {}), fontFamily, fontSize: size, lineHeight };
    handleUpdate({ preferences: nextPrefs }, { fontSize: size });
  };

  const handleSelectLineHeight = (lh) => {
    setLineHeight(lh);
    const nextPrefs = { ...(settings?.preferences || {}), fontFamily, fontSize, lineHeight: lh };
    handleUpdate({ preferences: nextPrefs }, { lineHeight: lh });
  };

  const handleToggleAutoPlay = () => {
    const nextVal = !autoPlay;
    setAutoPlay(nextVal);
    handleUpdate({ voice_auto_play: nextVal });
  };

  const handleVadChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVadSilenceMs(val);
  };

  const handleVadCommit = () => {
    handleUpdate({ voice_vad_silence_ms: vadSilenceMs });
  };

  const handleToggleSaveRecordings = () => {
    const nextVal = !saveRecordings;
    setSaveRecordings(nextVal);
    handleUpdate({ voice_save_audio_recordings: nextVal });
  };

  const handleSelectSpoiler = (policyId) => {
    setSpoilerPolicy(policyId);
    handleUpdate({ spoiler_policy: policyId });
  };

  return (
    <div className="settings-section-container" data-testid="reading-audio-section">
      <div className="settings-section-header">
        <div className="flex items-center justify-between">
          <h2 className="settings-section-title">Reading &amp; Audio</h2>
          {savingStatus === 'saved' && (
            <div className="settings-saved-pill" role="status">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section-body space-y-6">
        {/* Card 1: Reader Display & Typography */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Reader Display &amp; Typography</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Reading Atmosphere Dropdown */}
            <div className="settings-field-group">
              <label htmlFor="reading-theme-select" className="settings-label">
                Reading Atmosphere
              </label>
              <select
                id="reading-theme-select"
                aria-label="Reading Atmosphere"
                className="settings-select"
                value={readingTheme}
                onChange={(e) => handleSelectTheme(e.target.value)}
              >
                {Object.values(READER_THEMES).map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Family Dropdown */}
            <div className="settings-field-group">
              <label htmlFor="reading-font-select" className="settings-label">
                Font Family
              </label>
              <select
                id="reading-font-select"
                aria-label="Font Family"
                className="settings-select"
                value={fontFamily}
                onChange={(e) => handleSelectFontFamily(e.target.value)}
              >
                {Object.values(FONT_FAMILIES).map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size Dropdown */}
            <div className="settings-field-group">
              <label htmlFor="reading-size-select" className="settings-label">
                Font Size
              </label>
              <select
                id="reading-size-select"
                aria-label="Font Size"
                className="settings-select"
                value={fontSize}
                onChange={(e) => handleSelectFontSize(Number(e.target.value))}
              >
                {[14, 16, 18, 20, 22].map((size) => (
                  <option key={size} value={size}>
                    {size}px {size === 18 ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Line Spacing Dropdown */}
            <div className="settings-field-group">
              <label htmlFor="reading-spacing-select" className="settings-label">
                Line Spacing
              </label>
              <select
                id="reading-spacing-select"
                aria-label="Line Spacing"
                className="settings-select"
                value={lineHeight}
                onChange={(e) => handleSelectLineHeight(Number(e.target.value))}
              >
                <option value={1.5}>Compact (1.5x)</option>
                <option value={1.75}>Relaxed (1.75x)</option>
                <option value={2.0}>Loose (2.0x)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Audio & Voice */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Audio &amp; Voice</h3>
            </div>
          </div>

          <div className="security-rows-list">
            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Auto-Play Audio Narration</span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoPlay}
                  aria-label="Toggle auto-play narration"
                  className={`settings-toggle-switch ${autoPlay ? 'checked' : ''}`}
                  onClick={handleToggleAutoPlay}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>

            {/* VAD Silence Sensitivity Slider */}
            <div className="security-row flex-col items-start gap-2">
              <div className="w-full flex items-center justify-between">
                <span className="security-row-title">Speech Pause Sensitivity</span>
                <span className="settings-value-badge">
                  {(vadSilenceMs / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="w-full space-y-1">
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="100"
                  value={vadSilenceMs}
                  onChange={handleVadChange}
                  onMouseUp={handleVadCommit}
                  onTouchEnd={handleVadCommit}
                  onKeyUp={handleVadCommit}
                  aria-label="Speech pause sensitivity slider"
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Quick (0.5s)</span>
                  <span className="font-semibold text-stone-600 dark:text-stone-300">Natural (1.2s)</span>
                  <span>Deliberate (5.0s)</span>
                </div>
              </div>
            </div>

            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Save Audio Recordings</span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={saveRecordings}
                  aria-label="Toggle save audio recordings"
                  className={`settings-toggle-switch ${saveRecordings ? 'checked' : ''}`}
                  onClick={handleToggleSaveRecordings}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Spoiler Guardrail */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Spoiler Guardrail</h3>
            </div>
          </div>

          <div className="settings-field-group pt-1">
            <label htmlFor="spoiler-policy-select" className="settings-label">
              Narrative Boundary Policy
            </label>
            <select
              id="spoiler-policy-select"
              aria-label="Spoiler protection policy"
              className="settings-select"
              value={spoilerPolicy}
              onChange={(e) => handleSelectSpoiler(e.target.value)}
            >
              {SPOILER_POLICIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
