import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FollowAlongController from '../components/reader/FollowAlongController';
import SleepTimerModal from '../components/reader/SleepTimerModal';
import ListenModeView from '../components/reader/ListenModeView';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getChapterNarration: vi.fn(),
  },
}));

describe('SleepTimerModal Component', () => {
  it('renders timer options and calls onSelectTimer', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <SleepTimerModal
        isOpen={true}
        onClose={handleClose}
        activeMinutes={0}
        onSelectTimer={handleSelect}
        theme={{ cardBg: '#fff', text: '#000' }}
      />
    );

    expect(screen.getByRole('heading', { name: /Sleep Timer/i })).toBeInTheDocument();
    expect(screen.getByText('15 Minutes')).toBeInTheDocument();
    expect(screen.getByText('30 Minutes')).toBeInTheDocument();
    expect(screen.getByText('End of Chapter')).toBeInTheDocument();

    fireEvent.click(screen.getByText('30 Minutes'));
    expect(handleSelect).toHaveBeenCalledWith(30);
    expect(handleClose).toHaveBeenCalled();
  });
});

describe('FollowAlongController Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLMediaElement.prototype.load = vi.fn();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue();
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('loads chapter narration manifest and displays audio controls', async () => {
    lorelyApi.getChapterNarration.mockResolvedValueOnce({
      book_id: 'book-1',
      chapter_index: 0,
      chapter_title: 'Chapter 1',
      voice_id: 'nova',
      audio_url: 'http://localhost:5000/api/v1/reader/storage-proxy/narration.wav',
      duration_ms: 12000,
      segments: [
        { segment_index: 0, text: 'First spoken sentence.', start_time_ms: 0, end_time_ms: 5000 },
        { segment_index: 1, text: 'Second spoken sentence.', start_time_ms: 5000, end_time_ms: 12000 },
      ],
    });

    render(
      <FollowAlongController
        bookId="book-1"
        currentChapterIndex={0}
        onNextChapter={vi.fn()}
        onPrevChapter={vi.fn()}
        hasNextChapter={true}
        hasPrevChapter={false}
        onActiveSentenceChange={vi.fn()}
        theme={{ navBg: '#fff', text: '#000' }}
        mode="follow_along"
        session={{ access_token: 'fake' }}
        isFloatingHudVisible={true}
      />
    );

    await waitFor(() => {
      expect(lorelyApi.getChapterNarration).toHaveBeenCalledWith('book-1', 0, { voiceId: 'nova', speed: 1.0 }, 'fake');
    });

    // Check transport buttons
    expect(screen.getByRole('button', { name: /Play narration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rewind 15 seconds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forward 15 seconds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Playback speed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Select voice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sleep timer/i })).toBeInTheDocument();

    // Toggle Play
    const playBtn = screen.getByRole('button', { name: /Play narration/i });
    fireEvent.click(playBtn);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});

describe('ListenModeView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLMediaElement.prototype.load = vi.fn();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue();
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('renders audiobook interface with large cover and audio controls', async () => {
    lorelyApi.getChapterNarration.mockResolvedValueOnce({
      book_id: 'book-austen',
      chapter_index: 0,
      chapter_title: 'Chapter 1: The Arrival',
      voice_id: 'nova',
      audio_url: 'http://localhost:5000/api/v1/reader/storage-proxy/audio.wav',
      duration_ms: 25000,
      segments: [
        { segment_index: 0, text: 'It is a truth universally acknowledged.', start_time_ms: 0, end_time_ms: 5000 },
      ],
    });

    const handleSwitch = vi.fn();

    render(
      <ListenModeView
        bookData={{
          id: 'book-austen',
          title: 'Pride and Prejudice',
          author: 'Jane Austen',
        }}
        chapters={[{ chapter_order: 0, title: 'Chapter 1: The Arrival' }]}
        currentChapterIndex={0}
        onNextChapter={vi.fn()}
        onPrevChapter={vi.fn()}
        hasNextChapter={true}
        hasPrevChapter={false}
        theme={{ bg: '#fbf0d9', text: '#1c1917' }}
        session={{ access_token: 'fake-jwt' }}
        onSwitchMode={handleSwitch}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pride and Prejudice' })).toBeInTheDocument();
      expect(screen.getByText('Jane Austen')).toBeInTheDocument();
      expect(screen.getByText('Chapter 1: The Arrival')).toBeInTheDocument();
    });

    // Check mode switch button
    const switchBtn = screen.getByRole('button', { name: /Switch to Follow Along/i });
    expect(switchBtn).toBeInTheDocument();
    fireEvent.click(switchBtn);
    expect(handleSwitch).toHaveBeenCalledWith('follow_along');

    // Transport buttons
    expect(screen.getByRole('button', { name: /Play narration/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /Audiobook timeline/i })).toBeInTheDocument();
  });
});
