import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from '../components/AppShell';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  resolveAvatarUrl: (url) => url || null,
  lorelyApi: {
    getMe: vi.fn(),
    listNotifications: vi.fn(() => Promise.resolve([])),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    getPaymentConfig: vi.fn(() => Promise.resolve({ etb_rate: 135 })),
    getPlans: vi.fn(() => Promise.resolve([])),
  },
}));

describe('Instagram-Style Reader App Shell Navigation (Phase 1)', () => {
  const mockSignOut = vi.fn();
  const mockSession = {
    access_token: 'test-session-token',
    user: {
      email: 'dawit@lorely.ai',
      user_metadata: { full_name: 'Dawit Teklebrhan' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lorelyApi.getMe.mockResolvedValue({
      id: 'user-1',
      display_name: 'Dawit Teklebrhan',
      role: 'user',
      plan_tier: 'free',
    });
  });

  it('renders Instagram-style 3-group navigation links, brand mark, and utility items', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Lorely')).toBeInTheDocument();
    expect(screen.queryByText('Reader Studio')).not.toBeInTheDocument();

    // Verify main navigation links
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bookshelf/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /characters/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /chats/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();

    // Verify action and utility buttons
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add book/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('opens Add Book modal when Add book navigation button is clicked', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const addBookBtn = screen.getByRole('button', { name: /add book/i });
    expect(addBookBtn).toBeInTheDocument();

    fireEvent.click(addBookBtn);
    // Add Book modal dialog should open
    expect(screen.getByRole('dialog', { name: /add a book/i })).toBeInTheDocument();
  });

  it('toggles floating More popover menu with Settings, Switch appearance, and Log out', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const moreBtn = screen.getByRole('button', { name: /more/i });
    expect(moreBtn).toBeInTheDocument();

    // Open More popover
    fireEvent.click(moreBtn);
    expect(screen.getByRole('menu', { name: /more options/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /switch appearance/i })).toBeInTheDocument();

    const logoutBtn = screen.getByRole('menuitem', { name: /log out/i });
    fireEvent.click(logoutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('toggles notifications drawer and collapses sidebar to icon rail', () => {
    const { container } = render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const sidebar = container.querySelector('.lorely-sidebar');
    expect(sidebar).not.toHaveClass('collapsed');

    const notifBtn = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(notifBtn);

    expect(sidebar).toHaveClass('collapsed');
    expect(screen.getByTestId('notifications-dropdown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /notifications/i, level: 3 })).toBeInTheDocument();

    fireEvent.click(notifBtn);
    expect(sidebar).not.toHaveClass('collapsed');
  });

  it('confirms the top navigation bar is completely removed and canvas is full height', () => {
    const { container } = render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    // .lorely-top-header must not exist anywhere in the shell
    expect(container.querySelector('.lorely-top-header')).toBeNull();
    // The main container and page outlet take the full layout
    expect(container.querySelector('.lorely-main-container')).toBeInTheDocument();
    expect(container.querySelector('.lorely-page-outlet')).toBeInTheDocument();
  });
});
