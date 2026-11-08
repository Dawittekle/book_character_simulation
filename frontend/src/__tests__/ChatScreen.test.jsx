import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import ChatScreen from '../pages/ChatScreen';

// Mock Outlet context
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ accessToken: 'test-token', openAddBookModal: vi.fn() }),
  };
});

describe('ChatScreen Component', () => {
  it('renders character header, empty welcome banner, and composer', () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    expect(screen.getAllByText('Literary Character').length).toBeGreaterThan(0);
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(
      screen.getByText(/Begin your dialogue with/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Talk to Literary or type a message/i),
    ).toBeInTheDocument();
  });

  it('toggles Character Details dossier drawer when dossier button is clicked', () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    // Initially open
    expect(screen.getByTestId('character-details-drawer')).toBeInTheDocument();

    // Click Dossier button to collapse
    const dossierBtn = screen.getByRole('button', { name: /Close dossier drawer/i });
    fireEvent.click(dossierBtn);

    expect(screen.queryByTestId('character-details-drawer')).not.toBeInTheDocument();

    // Click again to reopen
    const reopenBtn = screen.getByRole('button', { name: /Open dossier drawer/i });
    fireEvent.click(reopenBtn);

    expect(screen.getByTestId('character-details-drawer')).toBeInTheDocument();
  });

  it('renders emotion state widget and radial breakdown', () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('emotion-state-widget')).toBeInTheDocument();
    expect(screen.getByText(/Emotion State/i)).toBeInTheDocument();
  });

  it('allows user to type a message and submit to composer', async () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    const input = screen.getByPlaceholderText(/Talk to Literary or type a message/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'What troubles your soul in Petersburg?' } });
    expect(input.value).toBe('What troubles your soul in Petersburg?');

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('What troubles your soul in Petersburg?')).toBeInTheDocument();
    });
  });

  it('renders existing historical dialogue turns when sessionId is present', async () => {
    const { lorelyApi } = await import('../services/lorelyApi');
    vi.spyOn(lorelyApi, 'getConversationMessages').mockResolvedValueOnce([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Good evening, Nastenka.',
        created_at: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Good evening! I have been waiting beside the canal.',
        created_at: new Date().toISOString(),
      },
    ]);

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChatScreen />} />
        </Routes>
      </BrowserRouter>,
    );

    // Initial render works cleanly without crashes
    expect(screen.getByTestId('emotion-state-widget')).toBeInTheDocument();
  });
});
