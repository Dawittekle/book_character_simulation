import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowUpRight, CheckCircle2, Download, AlertCircle, FileText } from 'lucide-react';
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
      // Fallback graceful free tier state
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
  const usage = data?.usage || {
    books: { used: 0, limit: 3 },
    daily_messages: { used: 0, limit: 20 },
    voice_minutes: { used: 0, limit: 0 },
  };
  const invoices = data?.invoices || [];
  const paymentMethod = data?.payment_method;

  const bookPct = usage.books.limit ? Math.min(100, Math.round((usage.books.used / usage.books.limit) * 100)) : 0;
  const msgPct = usage.daily_messages.limit ? Math.min(100, Math.round((usage.daily_messages.used / usage.daily_messages.limit) * 100)) : 0;
  const voicePct = usage.voice_minutes.limit ? Math.min(100, Math.round((usage.voice_minutes.used / usage.voice_minutes.limit) * 100)) : 0;

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
        {/* 1 & 2: Current Plan Card with Update Action */}
        <div className="billing-main-card">
          <div className="billing-card-top">
            <h3 className="billing-card-title">Billing</h3>
          </div>
          <hr className="billing-divider" />

          <div className="billing-plan-row">
            <div className="billing-plan-info">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="billing-plan-name font-serif">{sub.plan_name}</span>
                <span className="settings-badge-pill success">
                  {sub.is_paid ? 'Active' : 'Free Tier'}
                </span>
                <span className="settings-badge-pill">Monthly</span>
                {sub.is_paid && (
                  <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                    ${Number(sub.price_monthly).toFixed(2)} <span className="text-xs font-normal text-stone-500">/ month</span>
                  </span>
                )}
              </div>

              <p className="billing-plan-subtitle">
                {sub.is_paid
                  ? 'Self-serve premium tier with extended library quota and character voice turns.'
                  : 'Classic public domain library, reader annotations, and AI character dialogues.'}
              </p>

              {/* Compact Quota Metrics */}
              <div className="billing-quota-grid mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>
                    {usage.books.used} of {usage.books.is_unlimited ? '∞' : usage.books.limit} books uploaded
                  </span>
                  <span>{usage.books.is_unlimited ? 'Unlimited' : `${bookPct}%`}</span>
                </div>
                <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${usage.books.is_unlimited ? 100 : bookPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 pt-1">
                  <span>
                    {usage.daily_messages.used} of {usage.daily_messages.is_unlimited ? '∞' : usage.daily_messages.limit} daily messages
                  </span>
                  <span>{usage.daily_messages.is_unlimited ? 'Unlimited' : `${msgPct}%`}</span>
                </div>
                <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${usage.daily_messages.is_unlimited ? 100 : msgPct}%` }}
                  />
                </div>

                {usage.voice_minutes.limit > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 pt-1">
                      <span>
                        {usage.voice_minutes.used} of {usage.voice_minutes.limit} voice minutes
                      </span>
                      <span>{voicePct}%</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${voicePct}%` }}
                      />
                    </div>
                  </>
                )}

                {/* Optional Payment method line */}
                {paymentMethod && (
                  <div className="flex items-center gap-2 pt-2 text-xs text-stone-600 dark:text-stone-400">
                    <CreditCard size={14} className="text-stone-400" />
                    <span>
                      {paymentMethod.brand} ending in {paymentMethod.last4} · Expires {paymentMethod.expiry}
                    </span>
                  </div>
                )}
              </div>
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
