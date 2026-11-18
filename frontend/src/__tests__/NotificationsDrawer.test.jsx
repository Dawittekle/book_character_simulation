import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsDrawer from '../components/NotificationsDrawer';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    adminBroadcastNotification: vi.fn(),
  },
}));

describe('NotificationsDrawer (Instagram-Style Sliding Drawer)', () => {
  const mockOnClose = vi.fn();
  const mockOnUnreadCount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={false}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders drawer header, unread badge, and Instagram-style recency groups', async () => {
    const now = new Date();
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);

    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'n-unread',
        title: 'New Memory Recalled',
        message: 'Elizabeth Bennet mentioned Mr. Darcy.',
        category: 'character',
        is_read: false,
        created_at: now.toISOString(),
      },
      {
        id: 'n-today',
        title: 'Dostoevsky Collection Live',
        message: 'Three classic works added.',
        category: 'admin_broadcast',
        is_read: true,
        created_at: twoHoursAgo.toISOString(),
      },
      {
        id: 'n-week',
        title: 'White Nights Ingestion Complete',
        message: 'Book processed successfully.',
        category: 'ingestion',
        is_read: true,
        created_at: threeDaysAgo.toISOString(),
      },
      {
        id: 'n-earlier',
        title: 'Welcome to Lorely',
        message: 'Explore classical literature with AI.',
        category: 'system',
        is_read: true,
        created_at: tenDaysAgo.toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /notifications/i, level: 3 })).toBeInTheDocument();
      expect(screen.getByText('1 new')).toBeInTheDocument();
      expect(screen.getByText('New Memory Recalled')).toBeInTheDocument();
      expect(screen.getByText('Dostoevsky Collection Live')).toBeInTheDocument();
      expect(screen.getByText('White Nights Ingestion Complete')).toBeInTheDocument();
      expect(screen.getByText('Welcome to Lorely')).toBeInTheDocument();
    });

    // Check temporal section groupings
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
  });

  it('filters notifications when tabs are clicked', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'n-1',
        title: 'Platform Maintenance Notice',
        message: 'Scheduled downtime tonight.',
        category: 'admin_broadcast',
        is_read: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n-2',
        title: 'War and Peace Ingestion Finished',
        message: '1,200 pages analyzed.',
        category: 'ingestion',
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Maintenance Notice')).toBeInTheDocument();
      expect(screen.getByText('War and Peace Ingestion Finished')).toBeInTheDocument();
    });

    // Filter to Announcements only
    const announcementsTab = screen.getByRole('tab', { name: /announcements/i });
    fireEvent.click(announcementsTab);

    expect(screen.getByText('Platform Maintenance Notice')).toBeInTheDocument();
    expect(screen.queryByText('War and Peace Ingestion Finished')).not.toBeInTheDocument();

    // Filter to Processing only
    const processingTab = screen.getByRole('tab', { name: /processing/i });
    fireEvent.click(processingTab);

    expect(screen.queryByText('Platform Maintenance Notice')).not.toBeInTheDocument();
    expect(screen.getByText('War and Peace Ingestion Finished')).toBeInTheDocument();
  });

  it('marks single notification as read on button click', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-unread-1',
        title: 'Chapter 4 Analysis Ready',
        message: 'New character insights generated.',
        category: 'ingestion',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(lorelyApi.markNotificationRead).mockResolvedValueOnce({ id: 'notif-unread-1', is_read: true });

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chapter 4 Analysis Ready')).toBeInTheDocument();
    });

    const markReadBtn = screen.getByRole('button', { name: /mark read/i });
    fireEvent.click(markReadBtn);

    expect(lorelyApi.markNotificationRead).toHaveBeenCalledWith('notif-unread-1', 'token-123');
  });

  it('marks all notifications as read when clicking Mark all as read', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-1',
        title: 'Alert One',
        message: 'Message 1',
        category: 'system',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(lorelyApi.markAllNotificationsRead).mockResolvedValueOnce({ message: 'Success' });

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alert One')).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    expect(lorelyApi.markAllNotificationsRead).toHaveBeenCalledWith('token-123');
  });

  it('closes drawer when clicking backdrop or close button', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close notifications/i });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Click backdrop
    const backdrop = screen.getByTestId('notifications-backdrop');
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('closes drawer when pressing Escape key', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to link_url and closes drawer when notification item is clicked', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([
      {
        id: 'notif-link',
        title: 'Open Chat with Darcy',
        message: 'Darcy is waiting.',
        category: 'character',
        is_read: true,
        link_url: '/chats?id=darcy-1',
        created_at: new Date().toISOString(),
      },
    ]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open Chat with Darcy')).toBeInTheDocument();
    });

    const item = screen.getByRole('article');
    fireEvent.click(item);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/chats?id=darcy-1');
  });

  it('renders caught up empty state when notifications array is empty', async () => {
    vi.mocked(lorelyApi.listNotifications).mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <NotificationsDrawer
          isOpen={true}
          onClose={mockOnClose}
          accessToken="token-123"
          onUnreadCountChange={mockOnUnreadCount}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('You’re all caught up!')).toBeInTheDocument();
      expect(screen.getByText('No recent notifications.')).toBeInTheDocument();
    });
  });
});
