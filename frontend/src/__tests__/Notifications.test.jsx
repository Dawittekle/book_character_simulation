import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    adminBroadcastNotification: vi.fn(),
  },
}));

describe('NotificationsDropdown Component', () => {
  const mockOnClose = vi.fn();
  const mockOnUnreadCount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications list with categories and unread count', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-1',
        title: 'Fyodor Dostoevsky Collection Live',
        message: 'Three classic works are now available.',
        category: 'admin_broadcast',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        title: 'White Nights Ingestion Complete',
        message: 'Characters extracted and indexed.',
        category: 'ingestion',
        is_read: true,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <NotificationsDropdown
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('1 new')).toBeInTheDocument();
      expect(screen.getByText('Fyodor Dostoevsky Collection Live')).toBeInTheDocument();
      expect(screen.getByText('White Nights Ingestion Complete')).toBeInTheDocument();
    });
  });

  it('allows marking a notification as read', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-1',
        title: 'New Announcement',
        message: 'Please check the library.',
        category: 'admin_broadcast',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(lorelyApi.markNotificationRead).mockResolvedValueOnce({ id: 'notif-1', is_read: true });

    render(
      <MemoryRouter>
        <NotificationsDropdown
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Announcement')).toBeInTheDocument();
    });

    const markReadBtn = screen.getByRole('button', { name: /mark read/i });
    fireEvent.click(markReadBtn);

    expect(lorelyApi.markNotificationRead).toHaveBeenCalledWith('notif-1', 'token');
  });

  it('allows marking all notifications as read', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-1',
        title: 'First Alert',
        message: 'Message 1',
        category: 'system',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(lorelyApi.markAllNotificationsRead).mockResolvedValueOnce({ message: 'Success' });

    render(
      <MemoryRouter>
        <NotificationsDropdown
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('First Alert')).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    expect(lorelyApi.markAllNotificationsRead).toHaveBeenCalledWith('token');
  });
});
