import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileSection from '../pages/settings/components/ProfileSection';

describe('Phase 3: Profile & Avatar Management (Notion-Style)', () => {
  const mockMe = {
    id: 'user-1',
    email: 'jane@austen.org',
    full_name: 'Jane Austen',
    display_name: 'Jane A.',
    avatar_url: null,
    role: 'user',
    created_at: '2026-01-15T00:00:00Z',
    book_count: 4,
  };

  it('renders user details, initials fallback, and disabled save button by default', () => {
    render(<ProfileSection me={mockMe} />);

    expect(screen.getByText('Profile Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Austen')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane A.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@austen.org')).toBeInTheDocument();
    expect(screen.getByText('JA')).toBeInTheDocument(); // Initials fallback
    expect(screen.getByText('Account User')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Profile Changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it('renders avatar image if avatar_url is present', () => {
    const meWithAvatar = {
      ...mockMe,
      avatar_url: 'https://storage.lorely.app/avatars/user-1/portrait.png',
    };

    render(<ProfileSection me={meWithAvatar} />);

    const img = screen.getByRole('img', { name: /Jane A./i });
    expect(img).toHaveAttribute('src', 'https://storage.lorely.app/avatars/user-1/portrait.png');
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('tracks dirty state, enables save, supports discard, and submits updates', async () => {
    const handleUpdate = vi.fn().mockResolvedValue();

    render(<ProfileSection me={mockMe} onUpdateProfile={handleUpdate} />);

    const displayNameInput = screen.getByLabelText(/Display \/ Pen Name/i);
    const saveBtn = screen.getByRole('button', { name: /Save Profile Changes/i });

    // Change display name
    fireEvent.change(displayNameInput, { target: { value: 'Lady Jane' } });
    expect(saveBtn).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeInTheDocument();

    // Submit changes
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith({
        fullName: 'Jane Austen',
        displayName: 'Lady Jane',
      });
    });

    // Check success alert banner appears
    await waitFor(() => {
      expect(screen.getByText(/Your profile has been saved successfully/i)).toBeInTheDocument();
    });
  });

  it('discards unsaved modifications and restores original values', () => {
    render(<ProfileSection me={mockMe} />);

    const fullNameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(fullNameInput, { target: { value: 'Modified Name' } });
    expect(fullNameInput.value).toBe('Modified Name');

    const discardBtn = screen.getByRole('button', { name: /Discard/i });
    fireEvent.click(discardBtn);

    expect(fullNameInput.value).toBe('Jane Austen');
  });

  it('validates file upload format and size constraints', async () => {
    const handleUpload = vi.fn().mockResolvedValue();

    render(<ProfileSection me={mockMe} onUploadAvatar={handleUpload} />);

    const fileInput = screen.getByLabelText(/Upload profile avatar/i);

    // 1. Non-image file rejection
    const textFile = new File(['dummy text content'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Please select a valid image/i)).toBeInTheDocument();
    });
    expect(handleUpload).not.toHaveBeenCalled();

    // 2. Oversized file rejection (> 10MB)
    const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'giant.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Avatar image size must be less than 10MB/i)).toBeInTheDocument();
    });
    expect(handleUpload).not.toHaveBeenCalled();

    // 3. Valid image upload acceptance
    const validFile = new File([new Uint8Array(5000)], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(handleUpload).toHaveBeenCalledWith(validFile);
    });
  });

  it('triggers delete avatar handler when Remove button is clicked', async () => {
    const handleDelete = vi.fn().mockResolvedValue();
    const meWithAvatar = {
      ...mockMe,
      avatar_url: 'https://storage.lorely.app/avatars/user-1/portrait.png',
    };

    render(<ProfileSection me={meWithAvatar} onDeleteAvatar={handleDelete} />);

    const removeBtn = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalled();
    });
  });
});
