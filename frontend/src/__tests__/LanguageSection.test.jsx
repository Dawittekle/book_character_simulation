import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSection from '../pages/settings/components/LanguageSection';

describe('Phase 6: Language & Region Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders interface language options with English initially selected', () => {
    const me = { preferred_language: 'en' };
    const settings = { preferred_ui_language: 'en', preferred_conversation_language: 'en' };

    render(
      <LanguageSection
        me={me}
        settings={settings}
        onUpdateLanguage={vi.fn()}
        onUpdateSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Language & Region')).toBeInTheDocument();
    expect(screen.getByText('Interface Language')).toBeInTheDocument();

    const enCard = screen.getByRole('radio', { name: /Select English \(United States\)/i });
    const amCard = screen.getByRole('radio', { name: /Select Amharic \(Ethiopia\)/i });

    expect(enCard).toHaveAttribute('aria-checked', 'true');
    expect(amCard).toHaveAttribute('aria-checked', 'false');
  });

  it('switches interface language to Amharic and triggers onUpdateLanguage', () => {
    const handleUpdateLang = vi.fn().mockResolvedValue({});
    const me = { preferred_language: 'en' };
    const settings = { preferred_ui_language: 'en' };

    render(
      <LanguageSection
        me={me}
        settings={settings}
        onUpdateLanguage={handleUpdateLang}
        onUpdateSettings={vi.fn()}
      />
    );

    const amCard = screen.getByRole('radio', { name: /Select Amharic \(Ethiopia\)/i });
    fireEvent.click(amCard);

    expect(handleUpdateLang).toHaveBeenCalledWith('am');
    expect(amCard).toHaveAttribute('aria-checked', 'true');
  });

  it('switches character dialogue language and updates settings', () => {
    const handleUpdateSettings = vi.fn().mockResolvedValue({});
    const me = { preferred_language: 'en' };
    const settings = { preferred_ui_language: 'en', preferred_conversation_language: 'en' };

    render(
      <LanguageSection
        me={me}
        settings={settings}
        onUpdateLanguage={vi.fn()}
        onUpdateSettings={handleUpdateSettings}
      />
    );

    const amharicDialogueRadio = screen.getByRole('radio', {
      name: /Select አማርኛ \(Amharic\) for dialogue/i,
    });
    fireEvent.click(amharicDialogueRadio);

    expect(handleUpdateSettings).toHaveBeenCalledWith({
      preferred_conversation_language: 'am',
    });
  });

  it('renders clean language preferences without preview clutter', () => {
    const me = { preferred_language: 'am' };
    const settings = { preferred_ui_language: 'am' };

    render(
      <LanguageSection
        me={me}
        settings={settings}
        onUpdateLanguage={vi.fn()}
        onUpdateSettings={vi.fn()}
      />
    );

    expect(screen.getByText('Interface Language')).toBeInTheDocument();
    expect(screen.getByText('Character Dialogue Language')).toBeInTheDocument();
  });
});
