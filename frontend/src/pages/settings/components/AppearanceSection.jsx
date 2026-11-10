import React, { useState, useEffect } from 'react';
import { Sun, Moon, Laptop, Check, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  ACCENT_COLORS,
  applyAppTheme,
  applyAccentColor,
  applyHighContrast,
  applyReducedMotion,
} from '../../../lib/themeManager';

const THEME_MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Laptop },
];

export default function AppearanceSection({ settings, onUpdateSettings }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (settings?.app_theme) return settings.app_theme;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('lorely_app_theme') || 'light';
    }
    return 'light';
  });

  const [currentAccent, setCurrentAccent] = useState(() => {
    if (settings?.accent_color) return settings.accent_color;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('lorely_accent_color') || 'coral';
    }
    return 'coral';
  });

  const [highContrast, setHighContrast] = useState(() => {
    if (typeof settings?.high_contrast === 'boolean') return settings.high_contrast;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('lorely_high_contrast') === 'true';
    }
    return false;
  });

  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof settings?.reduced_motion === 'boolean') return settings.reduced_motion;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('lorely_reduced_motion') === 'true';
    }
    return false;
  });

  const [savingStatus, setSavingStatus] = useState(null); // null | 'saving' | 'saved'

  // Synchronize when settings prop updates
  useEffect(() => {
    if (settings?.app_theme && settings.app_theme !== currentTheme) {
      setCurrentTheme(settings.app_theme);
      applyAppTheme(settings.app_theme);
    }
    if (settings?.accent_color && settings.accent_color !== currentAccent) {
      setCurrentAccent(settings.accent_color);
      applyAccentColor(settings.accent_color);
    }
    if (typeof settings?.high_contrast === 'boolean' && settings.high_contrast !== highContrast) {
      setHighContrast(settings.high_contrast);
      applyHighContrast(settings.high_contrast);
    }
    if (typeof settings?.reduced_motion === 'boolean' && settings.reduced_motion !== reducedMotion) {
      setReducedMotion(settings.reduced_motion);
      applyReducedMotion(settings.reduced_motion);
    }
  }, [settings]);

  // Handle immediate theme mode selection
  const handleSelectMode = async (modeId) => {
    setCurrentTheme(modeId);
    applyAppTheme(modeId);
    setSavingStatus('saving');

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ app_theme: modeId });
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to persist app_theme:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  // Handle immediate brand accent selection
  const handleSelectAccent = async (accentId) => {
    setCurrentAccent(accentId);
    applyAccentColor(accentId);
    setSavingStatus('saving');

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ accent_color: accentId });
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to persist accent_color:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  // Handle high contrast toggle
  const handleToggleHighContrast = async () => {
    const nextVal = !highContrast;
    setHighContrast(nextVal);
    applyHighContrast(nextVal);
    setSavingStatus('saving');

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ high_contrast: nextVal });
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to persist high_contrast:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  // Handle reduced motion toggle
  const handleToggleReducedMotion = async () => {
    const nextVal = !reducedMotion;
    setReducedMotion(nextVal);
    applyReducedMotion(nextVal);
    setSavingStatus('saving');

    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ reduced_motion: nextVal });
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to persist reduced_motion:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  const activeAccentObj = ACCENT_COLORS.find((a) => a.id === currentAccent) || ACCENT_COLORS[0];

  return (
    <div className="settings-section-container" data-testid="appearance-section">
      <div className="settings-section-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="settings-section-title">Appearance & Themes</h2>
            <p className="settings-section-subtitle">
              Choose how Lorely looks on your device and personalize accent colors and accessibility.
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
        {/* Interface Theme (Clean Segmented Selector) */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Interface Theme</h3>
          </div>

          <div
            className="theme-mode-segmented-row"
            role="radiogroup"
            aria-label="Application appearance theme"
          >
            {THEME_MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = currentTheme === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${mode.label} theme`}
                  className={`theme-segment-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectMode(mode.id)}
                >
                  <Icon size={16} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brand Accent Colors */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Brand Accent Tint</h3>
          </div>

          <div
            className="accent-swatches-grid compact"
            role="radiogroup"
            aria-label="Brand accent colors"
          >
            {ACCENT_COLORS.map((accent) => {
              const isSelected = currentAccent === accent.id;

              return (
                <button
                  key={accent.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${accent.name} accent`}
                  className={`accent-swatch-card compact ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectAccent(accent.id)}
                >
                  <div
                    className="accent-color-disc"
                    style={{ backgroundColor: accent.hex }}
                  >
                    {isSelected && <Check size={14} className="text-white drop-shadow-sm" />}
                  </div>
                  <span className="accent-swatch-name font-medium">{accent.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accessibility & Vision Controls */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">Accessibility &amp; Motion</h3>
          </div>

          <div className="security-rows-list">
            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">High Contrast Mode</span>
                  <span className="security-row-desc">Enhance border and text definitions.</span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={highContrast}
                  aria-label="Toggle high contrast mode"
                  className={`settings-toggle-switch ${highContrast ? 'checked' : ''}`}
                  onClick={handleToggleHighContrast}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>

            <div className="security-row">
              <div className="security-row-left">
                <div className="security-row-info">
                  <span className="security-row-title">Reduced Motion</span>
                  <span className="security-row-desc">Minimize interface animations.</span>
                </div>
              </div>
              <div className="security-row-right">
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  aria-label="Toggle reduced motion"
                  className={`settings-toggle-switch ${reducedMotion ? 'checked' : ''}`}
                  onClick={handleToggleReducedMotion}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
