import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import speechSynthesisService from '../services/speechSynthesisService';
import WaveformPlayer from '../components/WaveformPlayer';

describe('SpeechSynthesis Service and Browser Voice Playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects browser speech synthesis support', () => {
    expect(speechSynthesisService.isSupported()).toBe(true);
  });

  it('cleans citation brackets and markdown from speech text', () => {
    const raw = '“I wait for you [Chapter 2: The Second Night] by the canal.” **Always!**';
    const cleaned = speechSynthesisService.cleanSpeechText(raw);
    expect(cleaned).not.toContain('Chapter 2');
    expect(cleaned).not.toContain('**');
    expect(cleaned).toContain('I wait for you');
    expect(cleaned).toContain('by the canal.');
  });

  it('tunes pitch and rate according to literary character archetype', () => {
    const nastenkaTuning = speechSynthesisService.getCharacterVoiceTuning('Nástyenka');
    expect(nastenkaTuning.pitch).toBeGreaterThan(1.0); // Youthful, higher pitch

    const astafyTuning = speechSynthesisService.getCharacterVoiceTuning('Astafy Ivanovich');
    expect(astafyTuning.pitch).toBeLessThan(1.0); // Deeper, measured baritone

    const dreamerTuning = speechSynthesisService.getCharacterVoiceTuning('The Dreamer');
    expect(dreamerTuning.rate).toBeLessThan(1.0); // Gentle, contemplative cadence
  });

  it('selects female or male voice based on character profile', () => {
    const femaleMatch = speechSynthesisService.selectVoice({
      characterName: 'Nastenka',
      gender: 'female',
    });
    expect(femaleMatch).toBeDefined();
    expect(femaleMatch.name).toMatch(/Female|US English/i);

    const maleMatch = speechSynthesisService.selectVoice({
      characterName: 'Astafy',
      gender: 'male',
    });
    expect(maleMatch).toBeDefined();
    expect(maleMatch.name).toMatch(/Male|US English/i);
  });

  it('triggers window.speechSynthesis.speak when speak() is called', () => {
    const onStart = vi.fn();
    speechSynthesisService.speak('Good evening, reader.', {
      characterName: 'Nastenka',
      gender: 'female',
      onStart,
    });

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    expect(speechSynthesisService.isSpeaking).toBe(true);
  });

  it('stops ongoing speech when stop() is called', () => {
    speechSynthesisService.speak('Testing speech.', {});
    speechSynthesisService.stop();

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(speechSynthesisService.isSpeaking).toBe(false);
  });
});

describe('WaveformPlayer with Browser Speech and Auto-Play', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('speaks character text aloud when Play button is clicked', () => {
    const text = 'Good day to you, my dear friend.';
    render(
      <WaveformPlayer
        speechText={text}
        characterName="Elizabeth Bennet"
        voiceGender="female"
        initialDuration={12}
      />
    );

    const playBtn = screen.getByRole('button', { name: /Play audio/i });
    fireEvent.click(playBtn);

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Pause audio/i })).toBeInTheDocument();
  });

  it('auto-plays character voice when autoPlay prop is true', () => {
    vi.useFakeTimers();
    const text = 'I am speaking automatically as soon as I arrive.';
    render(
      <WaveformPlayer
        speechText={text}
        characterName="The Dreamer"
        voiceGender="male"
        autoPlay={true}
        initialDuration={15}
      />
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
