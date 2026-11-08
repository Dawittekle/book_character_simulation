import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PricingModal from '../components/PricingModal';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getPlans: vi.fn().mockResolvedValue({
      plans: [
        {
          id: 'free',
          slug: 'free',
          name: 'Free Reader',
          category: 'personal',
          price_monthly: 0,
          description: 'Standard exploration with community access.',
          features: ['Unlimited chats', 'Standard classics'],
          badge: 'Current Tier',
        },
        {
          id: 'scholar',
          slug: 'scholar',
          name: 'Literary Scholar',
          category: 'personal',
          price_monthly: 20,
          description: 'Advanced cognitive simulations and HD speech.',
          features: ['HD Voice mode simulation', 'Emotion drift telemetry'],
          badge: 'Recommended',
        },
        {
          id: 'institution',
          slug: 'institution',
          name: 'Institutional Archive',
          category: 'business',
          price_monthly: 100,
          description: 'Dedicated vector search namespace and research exports.',
          features: ['Isolated Chroma vector namespace', 'Priority classification'],
          badge: 'Frontier Intelligence',
        },
      ],
    }),
    getPaymentConfig: vi.fn().mockResolvedValue({
      telebirr_phone: '+251 91 123 4567',
      telebirr_name: 'Dawit (Lorely Admin)',
      cbe_account: '1000123456789',
      cbe_name: 'Dawit (Lorely Admin)',
      etb_rate: 135.0,
      instructions: 'Transfer to verify',
    }),
    submitPayment: vi.fn(),
  },
}));

describe('PricingModal Component', () => {
  it('renders modal with database-backed plans and currency switcher', async () => {
    render(
      <PricingModal
        isOpen={true}
        onClose={vi.fn()}
        accessToken="test-token"
        userPlan="free"
        userEmail="reader@lorely.app"
      />
    );

    expect(screen.getByText('MEMBERSHIP TIERS')).toBeInTheDocument();
    expect(screen.getByText(/Choose Your Literary Journey/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /USD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ETB/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Literary Scholar')).toBeInTheDocument();
      expect(screen.getByText('Free Reader')).toBeInTheDocument();
      expect(screen.getByText('Institutional Archive')).toBeInTheDocument();
    });
  });

  it('switches currency between USD and ETB with live price conversion', async () => {
    render(
      <PricingModal
        isOpen={true}
        onClose={vi.fn()}
        accessToken="test-token"
        userPlan="free"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Literary Scholar')).toBeInTheDocument();
    });

    // Default USD shows $20
    expect(screen.getByText('$20')).toBeInTheDocument();

    // Click ETB currency pill
    const etbBtn = screen.getByRole('button', { name: /ETB/i });
    fireEvent.click(etbBtn);

    // 20 * 135 = 2,700 ETB
    await waitFor(() => {
      expect(screen.getByText(/2,700/i)).toBeInTheDocument();
    });
  });

  it('navigates to checkout and submits USD card payment successfully', async () => {
    vi.mocked(lorelyApi.submitPayment).mockResolvedValueOnce({
      id: 'pay-test-999',
      plan_slug: 'scholar',
      amount: 20.0,
      currency: 'USD',
      status: 'pending',
    });

    render(
      <PricingModal
        isOpen={true}
        onClose={vi.fn()}
        accessToken="test-token"
        userPlan="free"
        userEmail="reader@lorely.app"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Literary Scholar')).toBeInTheDocument();
    });

    // Click upgrade button on Scholar card
    const upgradeBtns = screen.getAllByRole('button', { name: /Upgrade to/i });
    fireEvent.click(upgradeBtns[0]);

    // Should now be on checkout step
    await waitFor(() => {
      expect(screen.getByText(/Upgrade to Literary Scholar/i)).toBeInTheDocument();
    });

    // Click Demo Card fill
    const autofillBtn = screen.getByRole('button', { name: /Autofill Demo Details/i });
    fireEvent.click(autofillBtn);

    // Submit payment
    const submitBtn = screen.getByRole('button', { name: /Submit Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(lorelyApi.submitPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_slug: 'scholar',
          amount: 20,
          currency: 'USD',
          payment_method: 'credit_card',
        }),
        'test-token'
      );
    });
  });

  it('supports Ethiopian Birr (ETB) payment submission with Telebirr reference', async () => {
    vi.mocked(lorelyApi.submitPayment).mockResolvedValueOnce({
      id: 'pay-etb-111',
      plan_slug: 'scholar',
      amount: 2700.0,
      currency: 'ETB',
      status: 'pending',
    });

    render(
      <PricingModal
        isOpen={true}
        onClose={vi.fn()}
        accessToken="test-token"
        userPlan="free"
        userEmail="reader@lorely.app"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Literary Scholar')).toBeInTheDocument();
    });

    // Switch to ETB first
    const etbBtn = screen.getByRole('button', { name: /ETB/i });
    fireEvent.click(etbBtn);

    const upgradeBtns = screen.getAllByRole('button', { name: /Upgrade to/i });
    fireEvent.click(upgradeBtns[0]);

    // Should display Telebirr / CBE details
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Telebirr/i })).toBeInTheDocument();
      expect(screen.getByText(/\+251 91 123 4567/i)).toBeInTheDocument();
    });

    // Test switching to CBE tab to see CBE account number
    const cbeTab = screen.getByRole('button', { name: /CBE/i });
    fireEvent.click(cbeTab);
    expect(screen.getByText(/1000123456789/i)).toBeInTheDocument();

    // Fill sender name and reference number
    fireEvent.change(screen.getByPlaceholderText(/e.g. Abebe Bikila/i), {
      target: { value: 'Abebe Bikila' },
    });
    fireEvent.change(screen.getByLabelText(/Transaction \/ Reference ID/i), {
      target: { value: 'TB-2026-9988' },
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(lorelyApi.submitPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_slug: 'scholar',
          currency: 'ETB',
          payment_method: 'cbe',
          payment_details: expect.objectContaining({
            payer_name: 'Abebe Bikila',
            reference_number: 'TB-2026-9988',
          }),
        }),
        'test-token'
      );
    });
  });
});
