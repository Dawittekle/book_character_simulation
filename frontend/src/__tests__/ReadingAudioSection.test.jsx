import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReadingAudioSection from '../pages/settings/components/ReadingAudioSection';

describe('Phase 6: Reading & Audio Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all 5 curated reader atmosphere themes with active selection', () => {
    const settings = {
      reading_theme: 'parchment',
      preferences: { fontFamily: 'serif', fontSize: 18, lineHeight: 1.75 },
      voice_auto_play: true,
      voice_vad_silence_ms: 1200,
      spoiler_policy: 'cautious',
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={vi.fn()} />);

    expect(screen.getByText('Reading & Audio Preferences')).toBeInTheDocument();
    expect(screen.getByText('Default Reader Atmosphere')).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /Select Warm Paper reader theme/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: /Select Pure White reader theme/i })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByRole('radio', { name: /Select Quiet Sepia reader theme/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Dark Slate reader theme/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Obsidian OLED reader theme/i })).toBeInTheDocument();
  });

  it('changes reader theme, persists to localStorage and triggers onUpdateSettings', () => {
    const handleUpdate = vi.fn().mockResolvedValue({ reading_theme: 'obsidian' });
    const settings = {
      reading_theme: 'parchment',
      preferences: {},
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    const obsidianRadio = screen.getByRole('radio', { name: /Select Obsidian OLED reader theme/i });
    fireEvent.click(obsidianRadio);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ reading_theme: 'obsidian' })
    );

    const savedReader = JSON.parse(localStorage.getItem('lorely_reader_settings') || '{}');
    expect(savedReader.theme).toBe('obsidian');
  });

  it('adjusts default typography: font family, font size, and line height', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      reading_theme: 'parchment',
      preferences: { fontFamily: 'serif', fontSize: 18, lineHeight: 1.75 },
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    // Switch font family to Modern Sans
    const sansBtn = screen.getByRole('radio', { name: /Select Modern Sans font/i });
    fireEvent.click(sansBtn);
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ fontFamily: 'sans' }),
      })
    );

    // Switch base font size to 20px
    const size20Btn = screen.getByRole('button', { name: /Set font size 20px/i });
    fireEvent.click(size20Btn);
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ fontSize: 20 }),
      })
    );

    // Switch line height to Loose (2.0x)
    const looseBtn = screen.getByRole('button', { name: /Set line height Loose \(2.0x\)/i });
    fireEvent.click(looseBtn);
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ lineHeight: 2.0 }),
      })
    );
  });

  it('controls speech pause sensitivity (VAD) slider and auto-play toggle', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      voice_auto_play: true,
      voice_vad_silence_ms: 1200,
      voice_save_audio_recordings: false,
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    // Toggle auto-play
    const autoPlaySwitch = screen.getByRole('switch', { name: /Toggle auto-play narration/i });
    expect(autoPlaySwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(autoPlaySwitch);
    expect(handleUpdate).toHaveBeenCalledWith({ voice_auto_play: false });

    // Slider change and commit
    const vadSlider = screen.getByLabelText(/Speech pause sensitivity slider/i);
    fireEvent.change(vadSlider, { target: { value: '2500' } });
    fireEvent.mouseUp(vadSlider);

    expect(handleUpdate).toHaveBeenCalledWith({ voice_vad_silence_ms: 2500 });
  });

  it('selects spoiler protection policy', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      spoiler_policy: 'cautious',
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    const strictRadio = screen.getByRole('radio', { name: /Select Strict Quarantine spoiler policy/i });
    fireEvent.click(strictRadio);

    expect(handleUpdate).toHaveBeenCalledWith({ spoiler_policy: 'strict' });
  });
});
