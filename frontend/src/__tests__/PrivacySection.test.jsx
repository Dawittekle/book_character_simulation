import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PrivacySection from '../pages/settings/components/PrivacySection';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('Privacy, Sign Out & Account Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders clean privacy page with Sign Out and Delete Account only', () => {
    render(<PrivacySection onSignOut={vi.fn()} onDeleteAccount={vi.fn()} />);

    expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign Out' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out of account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete my account permanently/i })).toBeInTheDocument();

    // Verify removed clutter & verbose phrases are gone
    expect(screen.queryByText(/Export Account Data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Storage & Data Integrity/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Irreversible actions that affect your account and data permanently/i)
    ).not.toBeInTheDocument();
  });

  it('triggers sign out on clicking Sign Out button', async () => {
    const handleSignOut = vi.fn().mockResolvedValue({});
    render(<PrivacySection onSignOut={handleSignOut} onDeleteAccount={vi.fn()} />);

    const signOutBtn = screen.getByRole('button', { name: /Sign out of account/i });
    fireEvent.click(signOutBtn);

    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it('opens Danger Zone deletion modal and keeps submit disabled until DELETE is entered', async () => {
    const handleDelete = vi.fn().mockResolvedValue({});
    const handleSignOut = vi.fn().mockResolvedValue({});
    render(<PrivacySection onSignOut={handleSignOut} onDeleteAccount={handleDelete} />);

    // Open modal
    const openModalBtn = screen.getByRole('button', { name: /Delete my account permanently/i });
    fireEvent.click(openModalBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Submit account deletion/i });
    expect(submitBtn).toBeDisabled();

    // Type something other than DELETE
    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'remove' } });
    expect(submitBtn).toBeDisabled();

    // Type DELETE
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(submitBtn).not.toBeDisabled();

    // Submit deletion
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledTimes(1);
      expect(handleSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
