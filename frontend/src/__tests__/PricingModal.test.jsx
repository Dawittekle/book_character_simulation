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
          description: 'Basic access',
          features: ['Unlimited chats'],
          badge: 'Your current plan',
        },
        {
          id: 'scholar',
          slug: 'scholar',
          name: 'Literary Scholar',
          category: 'personal',
          price_monthly: 20,
          description: 'Advanced cognitive simulations',
          features: ['HD Voice mode', 'Emotion drift telemetry'],
          badge: '✦ Most Popular',
        },
        {
          id: 'institution',
          slug: 'institution',
          name: 'Institutional Archive',
          category: 'business',
          price_monthly: 100,
          description: 'Dedicated vector search namespace',
          features: ['Isolated Chroma vector namespace'],
          badge: 'Frontier Intelligence',
        },
      ],
    }),
    submitPayment: vi.fn(),
  },
}));

describe('PricingModal Component', () => {
  it('renders modal with Personal and Business tiers', async () => {
    render(
      <PricingModal
        isOpen={true}
        onClose={vi.fn()}
        accessToken="test-token"
        userPlan="free"
        userEmail="reader@lorely.app"
      />
    );

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Literary Scholar')).toBeInTheDocument();
      expect(screen.getByText('Free Reader')).toBeInTheDocument();
    });
  });

  it('switches to business tiers when Business tab is clicked', async () => {
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

    const businessTab = screen.getByRole('tab', { name: 'Business' });
    fireEvent.click(businessTab);

    await waitFor(() => {
      expect(screen.getByText('Institutional Archive')).toBeInTheDocument();
    });
  });

  it('navigates to checkout and submits payment successfully', async () => {
    vi.mocked(lorelyApi.submitPayment).mockResolvedValueOnce({
      id: 'pay-test-999',
      plan_slug: 'scholar',
      amount: 20.0,
      currency: 'USD',
      status: 'pending',
      chosen_model: 'gemini-2.5-pro',
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

    // Click Claim free offer on Scholar card
    const upgradeBtn = screen.getByRole('button', { name: /Claim free offer/i });
    fireEvent.click(upgradeBtn);

    // Should now be on checkout step
    await waitFor(() => {
      expect(screen.getByText('Upgrade to Literary Scholar')).toBeInTheDocument();
    });

    // Select Gemini 2.5 Pro
    const modelSelect = screen.getByLabelText(/Chosen AI Reasoning Engine/i);
    fireEvent.change(modelSelect, { target: { value: 'gemini-2.5-pro' } });

    // Click Demo Card fill
    const autofillBtn = screen.getByRole('button', { name: /Autofill Demo Card/i });
    fireEvent.click(autofillBtn);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Submit Payment/i });
    fireEvent.click(submitBtn);

    // Verify submission success screen appears
    await waitFor(() => {
      expect(screen.getByText('Payment Submitted for Verification')).toBeInTheDocument();
      expect(screen.getByText(/pay-test-999/)).toBeInTheDocument();
    });

    expect(lorelyApi.submitPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_slug: 'scholar',
        chosen_model: 'gemini-2.5-pro',
      }),
      'test-token'
    );
  });
});
