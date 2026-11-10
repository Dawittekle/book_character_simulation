import React, { useState, useEffect } from 'react';
import { Globe, Languages, Calendar, Check, CheckCircle2 } from 'lucide-react';

const INTERFACE_LANGUAGES = [
  {
    code: 'en',
    nativeName: 'English (US)',
    englishName: 'English (United States)',
    flag: '🇺🇸',
    direction: 'ltr',
  },
  {
    code: 'am',
    nativeName: 'አማርኛ',
    englishName: 'Amharic (Ethiopia)',
    flag: '🇪🇹',
    direction: 'ltr',
  },
];

const DIALOGUE_LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    desc: 'Characters converse exclusively in English.',
  },
  {
    code: 'am',
    label: 'አማርኛ (Amharic)',
    desc: 'ገጸ-ባህሪያት በአማርኛ ቋንቋ ምላሽ ይሰጣሉ። (Characters reply in Amharic).',
  },
];

export default function LanguageSection({ settings, me, onUpdateLanguage, onUpdateSettings }) {
  const [selectedLanguage, setSelectedLanguage] = useState(
    () => me?.preferred_language || settings?.preferred_ui_language || 'en'
  );
  const [conversationLanguage, setConversationLanguage] = useState(
    () => settings?.preferred_conversation_language || 'en'
  );
  const [savingStatus, setSavingStatus] = useState(null);

  useEffect(() => {
    if (me?.preferred_language) {
      setSelectedLanguage(me.preferred_language);
    } else if (settings?.preferred_ui_language) {
      setSelectedLanguage(settings.preferred_ui_language);
    }
    if (settings?.preferred_conversation_language) {
      setConversationLanguage(settings.preferred_conversation_language);
    }
  }, [me, settings]);

  const handleSelectLanguage = async (code) => {
    setSelectedLanguage(code);
    setSavingStatus('saving');
    if (onUpdateLanguage) {
      try {
        await onUpdateLanguage(code);
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to update language:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  const handleSelectDialogueLanguage = async (code) => {
    setConversationLanguage(code);
    setSavingStatus('saving');
    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ preferred_conversation_language: code });
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(null), 2000);
      } catch (err) {
        console.warn('Failed to update conversation language:', err);
        setSavingStatus(null);
      }
    } else {
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus(null), 1500);
    }
  };

  // Sample localized formatted date
  const getLocalizedDate = () => {
    const now = new Date();
    try {
      return new Intl.DateTimeFormat(selectedLanguage === 'am' ? 'am-ET' : 'en-US', {
        dateStyle: 'full',
      }).format(now);
    } catch (e) {
      return now.toDateString();
    }
  };

  return (
    <div className="settings-section-container" data-testid="language-section">
      <div className="settings-section-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="settings-section-title">Language &amp; Region</h2>
            <p className="settings-section-subtitle">
              Choose your interface language, character dialogue language, and regional preferences.
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
        {/* Interface Language */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Languages size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Interface Language</h3>
            </div>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            role="radiogroup"
            aria-label="Interface language selection"
          >
            {INTERFACE_LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage === lang.code;

              return (
                <button
                  key={lang.code}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${lang.englishName}`}
                  className={`language-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectLanguage(lang.code)}
                >
                  <div className="language-card-content">
                    <span className="language-flag" role="img" aria-label={lang.englishName}>
                      {lang.flag}
                    </span>
                    <div className="language-meta">
                      <span className="language-native">{lang.nativeName}</span>
                      <span className="language-english">{lang.englishName}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="language-check">
                      <Check size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Character Conversation Language */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-amber-600 dark:text-amber-400" />
              <h3 className="settings-card-title">Character Dialogue Language</h3>
            </div>
          </div>

          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="Character dialogue language"
          >
            {DIALOGUE_LANGUAGES.map((item) => {
              const isSelected = conversationLanguage === item.code;

              return (
                <button
                  key={item.code}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select ${item.label} for dialogue`}
                  className={`spoiler-policy-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDialogueLanguage(item.code)}
                >
                  <div className="spoiler-card-left">
                    <div className="spoiler-radio-circle">
                      {isSelected && <span className="spoiler-radio-dot" />}
                    </div>
                    <div className="spoiler-card-info">
                      <span className="spoiler-card-title">{item.label}</span>
                      <span className="spoiler-card-desc">{item.desc}</span>
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
