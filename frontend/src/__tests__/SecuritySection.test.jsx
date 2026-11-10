import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SecuritySection from '../pages/settings/components/SecuritySection';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('Phase 4: Security & Google Password Setup (GitHub-Style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders configured password state for standard email/password users', async () => {
    const emailSession = {
      user: {
        id: 'user-email',
        email: 'reader@lorely.app',
        app_metadata: {
          providers: ['email'],
        },
        identities: [{ provider: 'email' }],
      },
    };

    render(<SecuritySection session={emailSession} me={{ email: 'reader@lorely.app' }} />);

    expect(screen.getByText('Security & Sign-in')).toBeInTheDocument();
    expect(screen.getByText('reader@lorely.app (Verified)')).toBeInTheDocument();
    expect(screen.getByText('Password is configured for this account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change account password/i })).toBeInTheDocument();
    expect(screen.getByText('No Google account connected')).toBeInTheDocument();
  });

  it('detects Google-only accounts and displays Set Password button', async () => {
    const googleSession = {
      user: {
        id: 'user-google',
        email: 'googleuser@gmail.com',
        app_metadata: {
          providers: ['google'],
        },
        identities: [{ provider: 'google' }],
      },
    };

    render(<SecuritySection session={googleSession} me={{ email: 'googleuser@gmail.com' }} />);

    expect(screen.getByText('No password set (Google single sign-on)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set account password/i })).toBeInTheDocument();
    expect(screen.getByText(/1 account connected \(googleuser@gmail\.com\)/i)).toBeInTheDocument();
  });

  it('validates password length and matching confirmation in modal', async () => {
    const googleSession = {
      user: {
        id: 'user-google',
        email: 'googleuser@gmail.com',
        app_metadata: {
          providers: ['google'],
        },
        identities: [{ provider: 'google' }],
      },
    };

    render(<SecuritySection session={googleSession} me={{ email: 'googleuser@gmail.com' }} />);

    // Open Set Password modal
    const setBtn = screen.getByRole('button', { name: /Set account password/i });
    fireEvent.click(setBtn);

    expect(screen.getByText('Set Account Password')).toBeInTheDocument();

    const newPassInput = screen.getByLabelText(/^New Password/i);
    const confirmPassInput = screen.getByLabelText(/Confirm Password/i);
    const submitBtn = screen.getByRole('button', { name: /^Submit set password$/i });

    // 1. Password < 6 characters
    fireEvent.change(newPassInput, { target: { value: '123' } });
    fireEvent.change(confirmPassInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 6 characters long/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    // 2. Mismatched passwords
    fireEvent.change(newPassInput, { target: { value: 'demo-short-input' } });
    fireEvent.change(confirmPassInput, { target: { value: 'demo-other-input' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match\. Please verify/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('calls supabase.auth.updateUser with new password on valid submission', async () => {
    supabase.auth.updateUser.mockResolvedValueOnce({ data: { user: {} }, error: null });

    const googleSession = {
      user: {
        id: 'user-google',
        email: 'googleuser@gmail.com',
        app_metadata: {
          providers: ['google'],
        },
        identities: [{ provider: 'google' }],
      },
    };

    render(<SecuritySection session={googleSession} me={{ email: 'googleuser@gmail.com' }} />);

    fireEvent.click(screen.getByRole('button', { name: /Set account password/i }));

    const newPassInput = screen.getByLabelText(/^New Password/i);
    const confirmPassInput = screen.getByLabelText(/Confirm Password/i);
    const submitBtn = screen.getByRole('button', { name: /^Submit set password$/i });

    fireEvent.change(newPassInput, { target: { value: 'demo-fixture-credential' } });
    fireEvent.change(confirmPassInput, { target: { value: 'demo-fixture-credential' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'demo-fixture-credential',
      });
    });

    // Verify modal closes and success banner appears
    await waitFor(() => {
      expect(screen.queryByText('Set Account Password')).not.toBeInTheDocument();
      expect(screen.getByText(/Your account password has been set/i)).toBeInTheDocument();
    });

    // Password row should now reflect "Change account password"
    expect(screen.getByRole('button', { name: /Change account password/i })).toBeInTheDocument();
  });

  it('signs out other sessions via supabase.auth.signOut({ scope: others })', async () => {
    supabase.auth.signOut.mockResolvedValueOnce({ error: null });

    render(<SecuritySection session={{ user: { id: 'u1', email: 'test@lorely.app' } }} />);

    const signOutBtn = screen.getByRole('button', { name: /Sign out of other sessions/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
      expect(screen.getByText(/Signed out of all other devices and browser sessions successfully/i)).toBeInTheDocument();
    });
  });
});
