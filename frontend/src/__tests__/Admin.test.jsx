import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AdminRouteGuard from '../pages/admin/AdminRouteGuard';
import AdminOverview from '../pages/admin/AdminOverview';
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import AdminCatalog from '../pages/admin/AdminCatalog';
import AdminJobs from '../pages/admin/AdminJobs';
import AdminPlans from '../pages/admin/AdminPlans';
import AdminSubscribers from '../pages/admin/AdminSubscribers';
import AdminSettings from '../pages/admin/AdminSettings';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getAdminOverview: vi.fn(),
    getAdminAnalytics: vi.fn(),
    adminListBooks: vi.fn(),
    adminListJobs: vi.fn(),
    adminRetryJob: vi.fn(),
    adminListUsers: vi.fn(),
    adminUpdateBook: vi.fn(),
    adminUpdateUserRole: vi.fn(),
    adminGetPlans: vi.fn(),
    adminUpdatePlan: vi.fn(),
    adminUpdateUserPlan: vi.fn(),
    adminGetSubscribers: vi.fn(),
    adminListPayments: vi.fn(),
    adminVerifyPayment: vi.fn(),
    adminRejectPayment: vi.fn(),
    getPaymentConfig: vi.fn(() => Promise.resolve({
      telebirr_phone: '+251 91 123 4567',
      telebirr_name: 'Dawit (Lorely Admin)',
      cbe_account: '1000123456789',
      cbe_name: 'Dawit (Lorely Admin)',
      etb_rate: 135.0,
      instructions: 'Transfer to verify',
    })),
    adminUpdatePaymentConfig: vi.fn(() => Promise.resolve({
      telebirr_phone: '+251 91 123 4567',
      telebirr_name: 'Dawit (Lorely Admin)',
      cbe_account: '1000123456789',
      cbe_name: 'Dawit (Lorely Admin)',
      etb_rate: 135.0,
      instructions: 'Transfer to verify',
    })),
    getStoredAdminToken: vi.fn(() => null),
    getStoredAdminUser: vi.fn(() => null),
    adminLogin: vi.fn(),
    adminLogout: vi.fn(),
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
          <Route element={<AdminRouteGuard />}>
            <Route path="/" element={<div>Secret Admin Dashboard</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Admin Login Portal</div>} />
        </Routes>
      </BrowserRouter>,
    );

    expect(screen.queryByText('Secret Admin Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Admin Login Portal')).toBeInTheDocument();
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

  it('renders AdminAnalytics with cognitive telemetry and character engagement', async () => {
    vi.mocked(lorelyApi.getAdminAnalytics).mockResolvedValueOnce({
      character_engagement: [
        {
          id: 'char-1',
          name: 'The Dreamer',
          book_title: 'White Nights',
          role: 'Protagonist',
          sessions_count: 5,
          messages_count: 24,
          unique_readers: 2,
          emotion_state: { hope: 0.85 },
        },
      ],
      plan_distribution: { free: 1, scholar: 3, institution: 0 },
      telemetry: {
        total_vector_chunks: 24,
        total_books: 3,
        total_messages: 24,
        total_users: 4,
        avg_retrieval_latency_ms: 22.4,
        vector_similarity_avg: 0.912,
        llm_provider: 'gemini',
        llm_model: 'gemini-3.5-flash',
      },
      timeline: [
        { day: 'Mon', turns: 12, hope: 78, longing: 65, anxiety: 22 },
      ],
    });

    render(
      <BrowserRouter>
        <AdminAnalytics />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Literary Analytics & Deep Telemetry')).toBeInTheDocument();
      expect(screen.getByText('The Dreamer')).toBeInTheDocument();
      expect(screen.getByText('Cognitive Emotion Drift Timeline')).toBeInTheDocument();
      expect(screen.getByText('Reader Tier Distribution')).toBeInTheDocument();
    });
  });

  it('renders AdminSubscribers with KPI metrics and pending verifications queue', async () => {
    vi.mocked(lorelyApi.adminGetSubscribers).mockResolvedValueOnce({
      total_subscribers: 3,
      mrr: 60.0,
      total_revenue: 120.0,
      pending_verifications: 1,
      verified_transactions: 2,
      free_readers: 5,
      total_users: 8,
      subscribers: [
        {
          id: 'sub-1',
          display_name: 'Fyodor Dostoevsky',
          email: 'fyodor@spb.ru',
          plan_tier: 'scholar',
          price_monthly: 20.0,
          active_model: 'gemini-2.5-pro',
          created_at: '2026-11-08T00:00:00Z',
        },
      ],
    });

    vi.mocked(lorelyApi.adminListPayments).mockResolvedValueOnce([
      {
        id: 'pay-test-1234',
        user_name: 'Anna Snitkina',
        user_email: 'anna@spb.ru',
        plan_slug: 'scholar',
        amount: 20.0,
        currency: 'USD',
        payment_method: 'credit_card',
        payment_details: { cardholder_name: 'Anna Snitkina', last4: '4242' },
        chosen_model: 'gemini-2.5-pro',
        status: 'pending',
        created_at: '2026-11-08T12:00:00Z',
      },
    ]);

    render(
      <BrowserRouter>
        <AdminSubscribers />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Subscribers & Payment Verification')).toBeInTheDocument();
      expect(screen.getByText('$60.00')).toBeInTheDocument();
      expect(screen.getAllByText('Anna Snitkina').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('PENDING APPROVAL')).toBeInTheDocument();
      expect(screen.getByText('✓ Verify & Upgrade')).toBeInTheDocument();
      expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    });
  });

  it('renders AdminSettings and allows configuring Telebirr and CBE bank accounts', async () => {
    render(
      <BrowserRouter>
        <AdminSettings />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('System & Payment Settings')).toBeInTheDocument();
      expect(screen.getByText(/Ethiopian Bank & Mobile Money/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('+251 91 123 4567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000123456789')).toBeInTheDocument();
    });
  });
});
