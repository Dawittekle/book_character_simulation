import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsHub from '../pages/settings/SettingsHub';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getMe: vi.fn(),
    getSettings: vi.fn(),
    updateMe: vi.fn(),
    updateSettings: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    getMySubscription: vi.fn(),
  },
}));

describe('Phase 2: Settings Navigation & Linear Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lorelyApi.getMe.mockResolvedValue({
      id: 'test-user-id',
      email: 'dawit@example.com',
      full_name: 'Dawit Teklebrhan',
      display_name: 'Dawit',
      avatar_url: null,
      preferred_language: 'en',
      role: 'user',
    });
    lorelyApi.getSettings.mockResolvedValue({
      app_theme: 'system',
      accent_color: 'coral',
      reading_theme: 'parchment',
      reduced_motion: false,
      high_contrast: false,
      spoiler_policy: 'cautious',
      preferred_ui_language: 'en',
    });
    lorelyApi.getMySubscription.mockResolvedValue({
      subscription: {
        plan_slug: 'scholar',
        plan_name: 'Scholar Edition',
        price_monthly: 12.0,
        currency: 'USD',
        is_paid: true,
      },
      usage: {
        books: { used: 0, limit: 10 },
        daily_messages: { used: 0, limit: 100 },
        voice_minutes: { used: 0, limit: 120 },
      },
      invoices: [],
    });
  });

  it('renders settings header and user identity card matching reference hierarchy', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(
      screen.getByText(/Manage your account, personalize your reading experience and control your subscription./i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Dawit')).toBeInTheDocument();
      expect(screen.getByText('dawit@example.com')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('renders all 4 Linear categories and 8 section items', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsHub />} />
        </Routes>
      </MemoryRouter>
    );

    // Categories
    expect(screen.getByText('ACCOUNT')).toBeInTheDocument();
    expect(screen.getByText('PREFERENCES')).toBeInTheDocument();
    expect(screen.getByText('PLAN')).toBeInTheDocument();
    expect(screen.getByText('PRIVACY')).toBeInTheDocument();

    // 8 Items
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Security & Sign-in')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Reading & Audio')).toBeInTheDocument();
    expect(screen.getByText('Language & Region')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Subscription & Billing')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
  });

  it('switches tabs and updates active content canvas on click', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsHub />} />
        </Routes>
      </MemoryRouter>
    );

    // Default tab is profile
    expect(screen.getByTestId('profile-section')).toBeInTheDocument();

    // Switch to Security
    const securityTab = screen.getByRole('tab', { name: /Security & Sign-in/i });
    fireEvent.click(securityTab);
    expect(screen.getByTestId('security-section')).toBeInTheDocument();

    // Switch to Appearance
    const appearanceTab = screen.getByRole('tab', { name: /Appearance/i });
    fireEvent.click(appearanceTab);
    expect(screen.getByTestId('appearance-section')).toBeInTheDocument();

    // Switch to Billing
    const billingTab = screen.getByRole('tab', { name: /Subscription & Billing/i });
    fireEvent.click(billingTab);
    expect(screen.getByTestId('billing-section')).toBeInTheDocument();

    // Switch to Privacy
    const privacyTab = screen.getByRole('tab', { name: /Privacy & Data/i });
    fireEvent.click(privacyTab);
    expect(screen.getByTestId('privacy-section')).toBeInTheDocument();
  });

  it('supports keyboard ArrowDown navigation between sidebar tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsHub />} />
        </Routes>
      </MemoryRouter>
    );

    const profileTab = screen.getByRole('tab', { name: /Profile/i });
    profileTab.focus();

    // Arrow down moves from Profile to Security & Sign-in
    fireEvent.keyDown(profileTab, { key: 'ArrowDown' });
    expect(screen.getByTestId('security-section')).toBeInTheDocument();

    // Arrow down moves to Appearance
    const securityTab = screen.getByRole('tab', { name: /Security & Sign-in/i });
    fireEvent.keyDown(securityTab, { key: 'ArrowDown' });
    expect(screen.getByTestId('appearance-section')).toBeInTheDocument();
  });

  it('handles initial URL search param tab selection', async () => {
    render(
      <MemoryRouter initialEntries={['/settings?tab=reading-audio']}>
        <Routes>
          <Route path="/settings" element={<SettingsHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('reading-audio-section')).toBeInTheDocument();
  });
});
