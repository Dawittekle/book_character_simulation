import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AdminRouteGuard from '../pages/admin/AdminRouteGuard';
import AdminOverview from '../pages/admin/AdminOverview';
import AdminCatalog from '../pages/admin/AdminCatalog';
import AdminJobs from '../pages/admin/AdminJobs';
import AdminPlans from '../pages/admin/AdminPlans';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getAdminOverview: vi.fn(),
    adminListBooks: vi.fn(),
    adminListJobs: vi.fn(),
    adminRetryJob: vi.fn(),
    adminListUsers: vi.fn(),
    adminUpdateBook: vi.fn(),
    adminUpdateUserRole: vi.fn(),
    adminGetPlans: vi.fn(),
    adminUpdateUserPlan: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ accessToken: 'admin-token' }),
  };
});

describe('Admin Portal & Route Guard', () => {
  it('guards admin routes when userRole is not admin', () => {
    render(
      <BrowserRouter>
        <Routes>
          <Route element={<AdminRouteGuard userRole="user" loading={false} />}>
            <Route path="/" element={<div>Secret Admin Dashboard</div>} />
          </Route>
          <Route path="/" element={<div>Public Reader Home</div>} />
        </Routes>
      </BrowserRouter>,
    );

    expect(screen.queryByText('Secret Admin Dashboard')).not.toBeInTheDocument();
  });

  it('renders AdminOverview metrics and recent jobs for admin users', async () => {
    vi.mocked(lorelyApi.getAdminOverview).mockResolvedValueOnce({
      health: 'healthy',
      counts: {
        users: 14,
        books: 6,
        characters: 18,
        conversations: 42,
        active_jobs: 2,
        failed_jobs: 1,
      },
      recent_jobs: [
        {
          id: 'job-987654321',
          status: 'failed',
          stage: 'extracting_characters',
          progress: 60,
          document_type: 'book',
          inferred_title: 'The Clockmaker Dilemma',
          error_message: 'Timeout occurred',
        },
      ],
    });

    render(
      <BrowserRouter>
        <AdminOverview />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('System Health & Telemetry')).toBeInTheDocument();
      expect(screen.getByText('All Services Operational')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('The Clockmaker Dilemma')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });
  });

  it('renders AdminCatalog and allows toggling featured status', async () => {
    vi.mocked(lorelyApi.adminListBooks).mockResolvedValueOnce([
      {
        id: 'book-1',
        title: 'The Midnight Letters',
        author: 'Elena Marlowe',
        owner_email: 'author@test.com',
        character_count: 2,
        visibility: 'featured',
      },
    ]);

    render(
      <BrowserRouter>
        <AdminCatalog />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Catalogue & Featured Works')).toBeInTheDocument();
      expect(screen.getByText('The Midnight Letters')).toBeInTheDocument();
      expect(screen.getByText('featured')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Unfeature/i })).toBeInTheDocument();
    });
  });

  it('renders AdminJobs and shows retry button for failed extractions', async () => {
    vi.mocked(lorelyApi.adminListJobs).mockResolvedValueOnce([
      {
        id: 'job-err-1234',
        inferred_title: 'Corrupted Manuscript.pdf',
        document_type: 'document',
        stage: 'failed',
        progress: 40,
        status: 'failed',
        error_message: 'Non-narrative cover letter detected',
      },
    ]);

    render(
      <BrowserRouter>
        <AdminJobs />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Background Extraction Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Corrupted Manuscript.pdf')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  it('renders Add Book button in AdminCatalog', async () => {
    vi.mocked(lorelyApi.adminListBooks).mockResolvedValueOnce([]);

    render(
      <BrowserRouter>
        <AdminCatalog />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Book to Shared Catalog/i })).toBeInTheDocument();
    });
  });

  it('renders AdminPlans with subscription tiers and user list', async () => {
    vi.mocked(lorelyApi.adminGetPlans).mockResolvedValueOnce({
      plans: [
        {
          id: 'free',
          name: 'Free Reader',
          price_monthly: 0,
          book_quota: 3,
          daily_messages: 20,
          voice_access: false,
        },
      ],
    });
    vi.mocked(lorelyApi.adminListUsers).mockResolvedValueOnce([
      {
        id: 'u-123',
        display_name: 'Dostoevsky Enthusiast',
        email: 'reader@classic.org',
        role: 'user',
        plan_tier: 'free',
        book_count: 2,
      },
    ]);

    render(
      <BrowserRouter>
        <AdminPlans />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Membership Plans & Quota Management')).toBeInTheDocument();
      expect(screen.getByText('Dostoevsky Enthusiast')).toBeInTheDocument();
      expect(screen.getByText('reader@classic.org')).toBeInTheDocument();
    });
  });
});
