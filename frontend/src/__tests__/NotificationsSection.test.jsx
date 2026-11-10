import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationsSection from '../pages/settings/components/NotificationsSection';

describe('Phase 6: Notifications & Alerts Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all notification channel toggles with defaults', () => {
    const settings = {
      notification_preferences: {
        email_digest: true,
        email_new_books: false,
        app_character_replies: true,
        app_reading_streaks: true,
        app_announcements: true,
      },
    };

    render(<NotificationsSection settings={settings} onUpdateNotifications={vi.fn()} />);

    expect(screen.getByText('Notifications & Alerts')).toBeInTheDocument();
    expect(screen.getByText('Weekly Reading Summary Digest')).toBeInTheDocument();
    expect(screen.getByText('New Book Arrivals & Classics')).toBeInTheDocument();
    expect(screen.getByText('Character Whispers & Dialogue Responses')).toBeInTheDocument();

    const digestSwitch = screen.getByRole('switch', { name: /Toggle weekly reading summary email/i });
    expect(digestSwitch).toHaveAttribute('aria-checked', 'true');

    const newBooksSwitch = screen.getByRole('switch', { name: /Toggle new book arrivals email/i });
    expect(newBooksSwitch).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles notification preferences and invokes onUpdateNotifications callback', () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      notification_preferences: {
        email_digest: true,
        email_new_books: false,
      },
    };

    render(<NotificationsSection settings={settings} onUpdateNotifications={handleUpdate} />);

    const newBooksSwitch = screen.getByRole('switch', { name: /Toggle new book arrivals email/i });
    fireEvent.click(newBooksSwitch);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        email_new_books: true,
      })
    );
  });
});
