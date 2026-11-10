import React, { useState, useEffect } from 'react';
import { BookOpen, Volume2, ShieldAlert, Check, Sliders, CheckCircle2 } from 'lucide-react';
import { READER_THEMES, FONT_FAMILIES } from '../../../components/reader/ReaderThemes';

const SPOILER_POLICIES = [
  {
    id: 'cautious',
    title: 'Cautious (Recommended)',
    description: 'Warns before disclosing plot twists or character arcs past your current chapter.',
    badge: 'Default',
  },
  {
    id: 'strict',
    title: 'Strict Quarantine',
    description: 'Hard-blocks characters from referencing unread chapters under any circumstances.',
    badge: 'Maximum Safety',
  },
  {
    id: 'unrestricted',
    title: 'Unrestricted Scholar',
    description: 'Characters freely analyze the entire novel, foreshadowing, and analytical climaxes.',
    badge: 'Full Lore',
  },
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
          <div>
            <h2 className="settings-section-title">Reading &amp; Audio Preferences</h2>
            <p className="settings-section-subtitle">
              Configure your default reader atmosphere, typography layout, voice sensitivity, and narrative boundaries.
            </p>
          </div>
          {savingStatus === 'saved' && (
            <div className="settings-saved-pill" role="status">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section-body space-y-6">
        {/* Default Reader Atmosphere Theme */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Default Reader Atmosphere</h3>
            </div>
            <p className="settings-card-description">
              Choose your default reading backdrop. (Stored separately from the application UI theme).
            </p>
          </div>

          <div
            className="reader-theme-grid"
            role="radiogroup"
            aria-label="Default reader theme"
          >
            {Object.values(READER_THEMES).map((theme) => {
              const isSelected = readingTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${theme.name} reader theme`}
                  className={`reader-theme-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectTheme(theme.id)}
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: isSelected ? 'var(--lorely-settings-accent, #e05a47)' : theme.border,
                    color: theme.text,
                  }}
                >
                  <div className="reader-theme-header">
                    <span className="reader-theme-name" style={{ color: theme.text }}>
                      {theme.name}
                    </span>
                    {isSelected && (
                      <span
                        className="reader-theme-check"
                        style={{
                          backgroundColor: 'var(--lorely-settings-accent, #e05a47)',
                          color: '#ffffff',
                        }}
                      >
                        <Check size={12} />
                      </span>
                    )}
                  </div>
                  <div
                    className="reader-theme-preview-box"
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.textMuted,
                    }}
                  >
                    <div
                      className="reader-preview-line accent"
                      style={{ backgroundColor: theme.accent }}
                    />
                    <div
                      className="reader-preview-line full"
                      style={{ backgroundColor: theme.border }}
                    />
                    <div
                      className="reader-preview-line half"
                      style={{ backgroundColor: theme.border }}
                    />
                  </div>
                  <span className="reader-theme-desc" style={{ color: theme.textMuted }}>
                    {theme.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Typography Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Default Typography</h3>
            <p className="settings-card-description">
              Fine-tune reading font family, base size, and line spacing across your library.
            </p>
          </div>

          <div className="space-y-4">
            {/* Font Family Selection */}
            <div className="settings-field-group">
              <label className="settings-label">Font Family</label>
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                role="radiogroup"
                aria-label="Font family selection"
              >
                {Object.values(FONT_FAMILIES).map((font) => {
                  const isSelected = fontFamily === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select ${font.name} font`}
                      className={`font-select-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectFontFamily(font.id)}
                    >
                      <span className="font-select-name" style={{ fontFamily: font.cssFamily }}>
                        {font.name}
                      </span>
                      <span className="font-select-sample" style={{ fontFamily: font.cssFamily }}>
                        Aa Bb Gg 123
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Base Font Size */}
            <div className="settings-field-group">
              <div className="flex items-center justify-between mb-2">
                <label className="settings-label">Base Font Size</label>
                <span className="settings-value-badge">{fontSize}px</span>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Font size options">
                {[14, 16, 18, 20, 22].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`btn-settings-pill ${fontSize === size ? 'active' : ''}`}
                    onClick={() => handleSelectFontSize(size)}
                    aria-label={`Set font size ${size}px`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height */}
            <div className="settings-field-group">
              <div className="flex items-center justify-between mb-2">
                <label className="settings-label">Line Spacing</label>
                <span className="settings-value-badge">
                  {lineHeight === 1.5 ? 'Compact' : lineHeight === 1.75 ? 'Relaxed' : 'Loose'} ({lineHeight}x)
                </span>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Line spacing options">
                {[
                  { value: 1.5, label: 'Compact (1.5x)' },
                  { value: 1.75, label: 'Relaxed (1.75x)' },
                  { value: 2.0, label: 'Loose (2.0x)' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`btn-settings-pill ${lineHeight === item.value ? 'active' : ''}`}
                    onClick={() => handleSelectLineHeight(item.value)}
                    aria-label={`Set line height ${item.label}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Narration & Voice Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Audio Narration &amp; Speech Detection</h3>
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
            <div className="security-row flex-col items-start gap-3">
              <div className="w-full flex items-center justify-between">
                <span className="security-row-title">Speech Pause Sensitivity (VAD)</span>
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

        {/* Spoiler Protection Policies */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Spoiler Protection Guardrail</h3>
            </div>
          </div>

          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Spoiler protection policy"
          >
            {SPOILER_POLICIES.map((policy) => {
              const isSelected = spoilerPolicy === policy.id;

              return (
                <button
                  key={policy.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${policy.title} spoiler policy`}
                  className={`spoiler-policy-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectSpoiler(policy.id)}
                >
                  <div className="spoiler-card-left">
                    <div className="spoiler-radio-circle">
                      {isSelected && <span className="spoiler-radio-dot" />}
                    </div>
                    <div className="spoiler-card-info">
                      <div className="flex items-center gap-2">
                        <span className="spoiler-card-title">{policy.title}</span>
                        <span className="settings-badge-pill">{policy.badge}</span>
                      </div>
                      <span className="spoiler-card-desc">{policy.description}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
