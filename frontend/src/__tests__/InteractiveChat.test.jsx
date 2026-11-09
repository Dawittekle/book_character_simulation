import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WaveformPlayer from '../components/WaveformPlayer';
import Conversations from '../pages/Conversations';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      accessToken: 'test-token',
    }),
  };
});

describe('Interactive Chat & Reading Room Suite (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WaveformPlayer Component', () => {
    it('renders waveform container with initial duration and play button', () => {
      render(<WaveformPlayer initialDuration={30} />);

      expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Play audio/i })).toBeInTheDocument();
      expect(screen.getByText(/0:30/)).toBeInTheDocument();
    });

    it('toggles playback state and updates icon / label', () => {
      render(<WaveformPlayer initialDuration={15} />);

      const playBtn = screen.getByRole('button', { name: /Play audio/i });
      fireEvent.click(playBtn);
      expect(screen.getByRole('button', { name: /Pause audio/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Pause audio/i }));
      expect(screen.getByRole('button', { name: /Play audio/i })).toBeInTheDocument();
    });
  });

  describe('Conversations Page', () => {
    const sampleConversations = [
      {
        id: 'conv-1',
        character_id: 'char-1',
        character_name: 'The Dreamer',
        book_title: 'White Nights',
        title: 'Four nights of moonlight in St. Petersburg',
        message_count: 8,
        spoiler_policy: 'conservative',
        last_message_at: new Date().toISOString(),
      },
    ];

    it('renders conversations list with character name, book, and turns', async () => {
      vi.spyOn(lorelyApi, 'listConversations').mockResolvedValueOnce(sampleConversations);

      render(
        <BrowserRouter>
          <Conversations />
        </BrowserRouter>
      );

      expect(screen.getByText('Your Conversations')).toBeInTheDocument();
      const charName = await screen.findByText('The Dreamer');
      expect(charName).toBeInTheDocument();
      expect(screen.getByText('(White Nights)')).toBeInTheDocument();
      expect(screen.getByText('8 turns')).toBeInTheDocument();
    });

    it('navigates to conversation on row click', async () => {
      vi.spyOn(lorelyApi, 'listConversations').mockResolvedValueOnce(sampleConversations);

      render(
        <BrowserRouter>
          <Conversations />
        </BrowserRouter>
      );

      const charName = await screen.findByText('The Dreamer');
      fireEvent.click(charName.closest('article'));
      expect(mockNavigate).toHaveBeenCalledWith('/chat/char-1/conv-1');
    });

    it('handles conversation deletion', async () => {
      vi.spyOn(lorelyApi, 'listConversations').mockResolvedValueOnce(sampleConversations);
      vi.spyOn(lorelyApi, 'deleteConversation').mockResolvedValueOnce({ ok: true });

      render(
        <BrowserRouter>
          <Conversations />
        </BrowserRouter>
      );

      const deleteBtn = await screen.findByRole('button', { name: /Delete conversation/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(lorelyApi.deleteConversation).toHaveBeenCalledWith('conv-1', 'test-token');
      });
    });

    it('displays empty state when no conversations exist', async () => {
      vi.spyOn(lorelyApi, 'listConversations').mockResolvedValueOnce([]);

      render(
        <BrowserRouter>
          <Conversations />
        </BrowserRouter>
      );

      const emptyTitle = await screen.findByText('No Conversations Yet');
      expect(emptyTitle).toBeInTheDocument();
      expect(screen.getByText('Explore Library →')).toBeInTheDocument();
    });
  });
});
