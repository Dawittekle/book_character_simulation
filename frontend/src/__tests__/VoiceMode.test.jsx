import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WaveformPlayer from '../components/WaveformPlayer';
import ChatScreen from '../pages/ChatScreen';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getCharacterDossier: vi.fn(),
    createConversation: vi.fn(),
    getConversationMessages: vi.fn(),
    listConversations: vi.fn().mockResolvedValue([]),
    sendConversationMessage: vi.fn(),
    sendVoiceTurn: vi.fn(),
    getMessageAudioUrl: vi.fn((sessionId, msgId) => `/api/v1/conversations/${sessionId}/messages/${msgId}/audio`),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      accessToken: 'test-token',
      user: { id: 'reader-1', email: 'reader@lorely.app' },
    }),
  };
});

describe('WaveformPlayer Component', () => {
  it('renders waveform container, play button, and timestamp', () => {
    render(<WaveformPlayer initialDuration={24} />);
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
    expect(screen.getByLabelText(/Play audio/i)).toBeInTheDocument();
    expect(screen.getByText(/0:24/)).toBeInTheDocument();
  });

  it('toggles playback when play button is clicked', () => {
    render(<WaveformPlayer initialDuration={20} />);
    const playBtn = screen.getByLabelText(/Play audio/i);
    fireEvent.click(playBtn);
    expect(screen.getByLabelText(/Pause audio/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Pause audio/i));
    expect(screen.getByLabelText(/Play audio/i)).toBeInTheDocument();
  });
});

describe('Voice Mode in ChatScreen', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('activates voice recording mode when microphone button is clicked', async () => {
    lorelyApi.getCharacterDossier.mockResolvedValueOnce({
      id: 'char-1',
      name: 'Elena Marlowe',
      book_title: 'The Midnight Letters',
      role: 'Protagonist',
      emotion_state: { hope: 0.8 },
    });

    render(
      <MemoryRouter initialEntries={['/chat/char-1']}>
        <Routes>
          <Route path="/chat/:characterId" element={<ChatScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const micBtn = screen.getByLabelText(/Activate microphone/i);
    expect(micBtn).toBeInTheDocument();

    // Click mic button to activate voice mode
    fireEvent.click(micBtn);

    // Banner should appear
    expect(await screen.findByTestId('voice-recording-banner')).toBeInTheDocument();
    expect(screen.getByText(/Listening to your voice/i)).toBeInTheDocument();
  });

  it('submits voice turn and displays synthesized voice audio reply', async () => {
    lorelyApi.getCharacterDossier.mockResolvedValueOnce({
      id: 'char-1',
      name: 'Elena Marlowe',
      book_title: 'The Midnight Letters',
      role: 'Protagonist',
      emotion_state: { hope: 0.8 },
    });
    lorelyApi.createConversation.mockResolvedValueOnce({ id: 'session-voice-2' });
    lorelyApi.getConversationMessages.mockResolvedValueOnce([]);

    lorelyApi.sendVoiceTurn.mockResolvedValueOnce({
      assistant_message_id: 'msg-asst-voice-1',
      response: 'I heard you clearly through the evening breeze.',
      citations: [],
      audio: {
        mime_type: 'audio/wav',
        duration: 3.2,
        base64_data: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        speech_text: 'Hello Elena',
      },
      updated_state: {
        emotion_state: { hope: 0.95 },
      },
    });

    render(
      <MemoryRouter initialEntries={['/chat/char-1']}>
        <Routes>
          <Route path="/chat/:characterId" element={<ChatScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for dossier to load
    await waitFor(() => {
      expect(lorelyApi.getCharacterDossier).toHaveBeenCalled();
    });

    // Click mic button
    const micBtn = screen.getByLabelText(/Activate microphone/i);
    fireEvent.click(micBtn);

    // The banner appears with "Send Voice"
    const sendVoiceBtn = await screen.findByText(/Send Voice/i);
    fireEvent.click(sendVoiceBtn);

    // Verify conversation was created and voice turn was sent
    await waitFor(() => {
      expect(lorelyApi.createConversation).toHaveBeenCalled();
      expect(lorelyApi.sendVoiceTurn).toHaveBeenCalledWith(
        'session-voice-2',
        expect.objectContaining({ speechText: expect.any(String) }),
        'test-token'
      );
    });

    // Character voice reply and waveform should be displayed
    expect(await screen.findByText('I heard you clearly through the evening breeze.')).toBeInTheDocument();
    const waveformElements = screen.getAllByTestId('waveform-player');
    expect(waveformElements.length).toBeGreaterThan(0);
  });
});
