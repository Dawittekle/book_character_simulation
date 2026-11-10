import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BillingSection from '../pages/settings/components/BillingSection';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getMySubscription: vi.fn(),
  },
}));

describe('Phase 7: Subscription, Billing & Invoices (Stripe-Style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders server-verified plan tier, quota progress bars, and payment method', async () => {
    const mockData = {
      subscription: {
        plan_slug: 'scholar',
        plan_name: 'Scholar Edition',
        price_monthly: 12.0,
        currency: 'USD',
        status: 'active',
        billing_cycle: 'monthly',
        is_paid: true,
        features: ['Full library access', 'Voice turn simulation'],
      },
      usage: {
        books: { used: 3, limit: 10, is_unlimited: false },
        daily_messages: { used: 15, limit: 100, is_unlimited: false },
        voice_minutes: { used: 25.5, limit: 120, is_unlimited: false },
      },
      payment_method: {
        type: 'credit_card',
        brand: 'Visa',
        last4: '4242',
        expiry: '12/2030',
      },
      invoices: [
        {
          id: 'pay-001',
          invoice_number: 'INV-202611-001',
          billing_date: '2026-11-01T00:00:00Z',
          amount: 12.0,
          currency: 'USD',
          status: 'Paid',
          payment_method: 'credit_card',
          plan_name: 'Scholar',
        },
      ],
    };

    lorelyApi.getMySubscription.mockResolvedValueOnce(mockData);

    render(<BillingSection onOpenPricingModal={vi.fn()} accessToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Scholar Edition')).toBeInTheDocument();
    });

    expect(screen.getByText('$12.00')).toBeInTheDocument();

    // Verify payment method
    expect(screen.getByText(/Visa ending in 4242/i)).toBeInTheDocument();
    expect(screen.getByText(/Expires 12\/2030/i)).toBeInTheDocument();

    // Verify invoice table
    expect(screen.getByText('INV-202611-001')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('$12.00 USD')).toBeInTheDocument();
  });

  it('invokes onOpenPricingModal when clicking Change plan', async () => {
    const mockOpenModal = vi.fn();
    lorelyApi.getMySubscription.mockResolvedValueOnce({
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

    render(<BillingSection onOpenPricingModal={mockOpenModal} accessToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Scholar Edition')).toBeInTheDocument();
    });

    const changePlanBtn = screen.getByRole('button', { name: /Change subscription plan/i });
    fireEvent.click(changePlanBtn);

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('triggers receipt download on clicking download button', async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    lorelyApi.getMySubscription.mockResolvedValueOnce({
      subscription: {
        plan_slug: 'scholar',
        plan_name: 'Scholar Edition',
        price_monthly: 12.0,
        currency: 'USD',
        is_paid: true,
      },
      usage: {
        books: { used: 1, limit: 10 },
        daily_messages: { used: 5, limit: 100 },
        voice_minutes: { used: 0, limit: 120 },
      },
      invoices: [
        {
          id: 'pay-002',
          invoice_number: 'INV-202611-999',
          billing_date: '2026-11-02T10:00:00Z',
          amount: 12.0,
          currency: 'USD',
          status: 'Paid',
          payment_method: 'credit_card',
          plan_name: 'Scholar',
        },
      ],
    });

    render(<BillingSection onOpenPricingModal={vi.fn()} accessToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('INV-202611-999')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', {
      name: /Download receipt for INV-202611-999/i,
    });
    fireEvent.click(downloadBtn);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });
});
