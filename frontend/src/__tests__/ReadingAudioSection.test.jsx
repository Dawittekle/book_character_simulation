import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReadingAudioSection from '../pages/settings/components/ReadingAudioSection';

describe('Phase 6: Reading & Audio Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all dropdown selectors with initial values', () => {
    const settings = {
      reading_theme: 'parchment',
      preferences: { fontFamily: 'serif', fontSize: 18, lineHeight: 1.75 },
      voice_auto_play: true,
      voice_vad_silence_ms: 1200,
      spoiler_policy: 'cautious',
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={vi.fn()} />);

    expect(screen.getByText('Reading & Audio')).toBeInTheDocument();
    expect(screen.getByLabelText('Reading Atmosphere')).toHaveValue('parchment');
    expect(screen.getByLabelText('Font Family')).toHaveValue('serif');
    expect(screen.getByLabelText('Font Size')).toHaveValue('18');
    expect(screen.getByLabelText('Line Spacing')).toHaveValue('1.75');
    expect(screen.getByLabelText('Spoiler protection policy')).toHaveValue('cautious');
  });

  it('changes reader theme, persists to localStorage and triggers onUpdateSettings', () => {
    const handleUpdate = vi.fn().mockResolvedValue({ reading_theme: 'obsidian' });
    const settings = {
      reading_theme: 'parchment',
      preferences: {},
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    const themeSelect = screen.getByLabelText('Reading Atmosphere');
    fireEvent.change(themeSelect, { target: { value: 'obsidian' } });

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ reading_theme: 'obsidian' })
    );

    const savedReader = JSON.parse(localStorage.getItem('lorely_reader_settings') || '{}');
    expect(savedReader.theme).toBe('obsidian');
  });

  it('adjusts default typography: font family, font size, and line height via dropdowns', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      reading_theme: 'parchment',
      preferences: { fontFamily: 'serif', fontSize: 18, lineHeight: 1.75 },
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    // Switch font family to Modern Sans
    const fontSelect = screen.getByLabelText('Font Family');
    fireEvent.change(fontSelect, { target: { value: 'sans' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ fontFamily: 'sans' }),
      })
    );

    // Switch base font size to 20px
    const sizeSelect = screen.getByLabelText('Font Size');
    fireEvent.change(sizeSelect, { target: { value: '20' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ fontSize: 20 }),
      })
    );

    // Switch line height to Loose (2.0x)
    const spacingSelect = screen.getByLabelText('Line Spacing');
    fireEvent.change(spacingSelect, { target: { value: '2' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ lineHeight: 2 }),
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

  it('selects spoiler protection policy via dropdown', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      spoiler_policy: 'cautious',
    };

    render(<ReadingAudioSection settings={settings} onUpdateSettings={handleUpdate} />);

    const spoilerSelect = screen.getByLabelText('Spoiler protection policy');
    fireEvent.change(spoilerSelect, { target: { value: 'strict' } });

    expect(handleUpdate).toHaveBeenCalledWith({ spoiler_policy: 'strict' });
  });
});
