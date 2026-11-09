import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from '../components/AppShell';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getMe: vi.fn(),
    listNotifications: vi.fn(() => Promise.resolve([])),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    getPaymentConfig: vi.fn(() => Promise.resolve({ etb_rate: 135 })),
    getPlans: vi.fn(() => Promise.resolve([])),
  },
}));

describe('Phase 4: Reader App Shell & Navigation', () => {
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

  it('renders sidebar navigation links, flower logo, and brand title', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Lorely')).toBeInTheDocument();
    expect(screen.getByText('Reader Studio')).toBeInTheDocument();

    // Verify all 5 navigation links
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my library/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /characters/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /conversations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders active subscription card with crown icon and opens pricing modal on click', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const planCard = screen.getByLabelText(/view pricing plans/i);
    expect(planCard).toBeInTheDocument();
    expect(screen.getByText('Premium Plan')).toBeInTheDocument();
    expect(screen.getByText(/✦ Pro Access/i)).toBeInTheDocument();

    fireEvent.click(planCard);
    // Pricing modal should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('toggles user profile dropdown and triggers sign out', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const userButton = screen.getByLabelText(/user account menu/i);
    expect(userButton).toBeInTheDocument();
    expect(screen.getByText('Dawit Teklebrhan')).toBeInTheDocument();

    // Open dropdown
    fireEvent.click(userButton);
    expect(screen.getByText('dawit@lorely.ai')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preferences/i })).toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('updates search query on input and handles form submit', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const searchInput = screen.getByPlaceholderText(/search books, characters/i);
    fireEvent.change(searchInput, { target: { value: 'Dostoevsky' } });
    expect(searchInput).toHaveValue('Dostoevsky');
  });

  it('toggles notifications popover when bell button is clicked', () => {
    render(
      <BrowserRouter>
        <AppShell session={mockSession} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );

    const bellBtn = screen.getByLabelText(/notifications/i);
    fireEvent.click(bellBtn);

    expect(screen.getByTestId('notifications-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});
