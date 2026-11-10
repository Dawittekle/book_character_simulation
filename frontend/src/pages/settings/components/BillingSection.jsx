import React, { useState, useEffect } from 'react';
import { CreditCard, Download, AlertCircle, FileText } from 'lucide-react';
import { lorelyApi } from '../../../services/lorelyApi';

export default function BillingSection({ onOpenPricingModal, accessToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await lorelyApi.getMySubscription(accessToken);
      setData(res);
    } catch (err) {
      console.warn('Failed to fetch subscription data:', err);
      // Graceful fallback state
      setData({
        subscription: {
          plan_slug: 'free',
          plan_name: 'Lorely Free',
          price_monthly: 0,
          currency: 'USD',
          status: 'active',
          billing_cycle: 'monthly',
          is_paid: false,
        },
        usage: {
          books: { used: 0, limit: 3, is_unlimited: false },
          daily_messages: { used: 0, limit: 20, is_unlimited: false },
          voice_minutes: { used: 0, limit: 0, is_unlimited: false },
        },
        payment_method: null,
        invoices: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, [accessToken]);

  const handleDownloadReceipt = (invoice) => {
    const receiptContent = `===========================================
LORELY LITERARY SIMULATION — RECEIPT
===========================================
Invoice: ${invoice.invoice_number}
Date: ${invoice.billing_date || new Date().toISOString()}
Plan: ${invoice.plan_name}
Amount: $${Number(invoice.amount).toFixed(2)} ${invoice.currency}
Status: ${invoice.status}
Payment Method: ${(invoice.payment_method || 'CARD').toUpperCase()}
===========================================
Thank you for reading with Lorely!
`;
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lorely_Receipt_${invoice.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sub = data?.subscription || {
    plan_slug: 'free',
    plan_name: 'Lorely Free',
    price_monthly: 0,
    currency: 'USD',
    is_paid: false,
  };
  const invoices = data?.invoices || [];
  const paymentMethod = data?.payment_method;

  return (
    <div className="settings-section-container" data-testid="billing-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">Billing &amp; Subscription</h2>
      </div>

      {error && (
        <div className="settings-alert-banner error mb-4" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-section-body space-y-6">
        {/* 1 & 2: Current Plan Card with Compare/Change Action */}
        <div className="billing-main-card">
          <div className="billing-card-top">
            <h3 className="billing-card-title">Billing</h3>
          </div>
          <hr className="billing-divider" />

          <div className="billing-plan-row">
            <div className="billing-plan-info">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="billing-plan-name font-serif">{sub.plan_name}</span>
                {sub.is_paid && (
                  <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                    ${Number(sub.price_monthly).toFixed(2)}{' '}
                    <span className="text-xs font-normal text-stone-500">/ month</span>
                  </span>
                )}
              </div>

              <p className="billing-plan-subtitle">
                {sub.is_paid
                  ? 'Self-serve premium tier with extended library access and character voice simulation.'
                  : 'Digital reading library, character dialogues & literary exploration.'}
              </p>

              {paymentMethod && (
                <div className="flex items-center gap-2 pt-3 text-xs text-stone-500">
                  <CreditCard size={14} className="text-stone-400" />
                  <span>
                    {paymentMethod.brand} ending in {paymentMethod.last4} · Expires {paymentMethod.expiry}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Update Plan Button */}
            <div className="billing-action-col">
              <button
                type="button"
                className="billing-compare-btn"
                onClick={onOpenPricingModal}
                aria-label="Change subscription plan"
              >
                <span>{sub.is_paid ? 'Change plan' : 'Compare plans'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Payment & Invoice History */}
        <div>
          <div className="billing-section-tracked-label">
            PAYMENT &amp; INVOICE HISTORY
          </div>

          <div className="billing-history-card">
            {invoices.length > 0 ? (
              <div className="invoices-table-wrapper w-full">
                <table className="invoices-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Billing Date</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-semibold text-stone-900 dark:text-stone-100">
                          {inv.invoice_number}
                        </td>
                        <td className="text-stone-600 dark:text-stone-400">
                          {inv.billing_date ? new Date(inv.billing_date).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span
                            className={`settings-badge-pill ${
                              inv.status === 'Paid' ? 'success' : inv.status === 'Pending' ? '' : 'danger'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="font-mono text-stone-900 dark:text-stone-100">
                          ${Number(inv.amount).toFixed(2)} {inv.currency}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn-settings-ghost-sm"
                            onClick={() => handleDownloadReceipt(inv)}
                            aria-label={`Download receipt for ${inv.invoice_number}`}
                          >
                            <Download size={13} />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="billing-empty-state">
                <div className="billing-empty-icon-wrap">
                  <FileText size={28} className="billing-empty-icon" />
                </div>
                <h4 className="billing-empty-title">No payment invoices yet</h4>
                <p className="billing-empty-sub">
                  You are currently enjoying your free plan. Your billing history and receipts will be recorded here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
