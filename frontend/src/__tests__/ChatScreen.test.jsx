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
  it('renders character header, message thread, and composer', () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    expect(screen.getAllByText('Elena Marlowe').length).toBeGreaterThan(0);
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(
      screen.getByText(/Hello there! It's wonderful to meet you/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Talk to Elena or type a message/i),
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

  it('renders emotion state radial breakdown and insight summary', () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('emotion-state-widget')).toBeInTheDocument();
    expect(screen.getAllByText('78%').length).toBeGreaterThan(0);
    expect(screen.getByText(/Her optimism has increased after your last conversation/i)).toBeInTheDocument();
  });

  it('allows user to type a message and appends to stream', async () => {
    render(
      <BrowserRouter>
        <ChatScreen />
      </BrowserRouter>,
    );

    const input = screen.getByPlaceholderText(/Talk to Elena or type a message/i);
    const sendBtn = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(input, { target: { value: 'What are your thoughts on second chances?' } });
    expect(input.value).toBe('What are your thoughts on second chances?');

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('What are your thoughts on second chances?')).toBeInTheDocument();
    });
  });
});
