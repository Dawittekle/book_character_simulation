import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminSubscribers.css';

export default function AdminSubscribers() {
  const { accessToken } = useOutletContext();
  const [metrics, setMetrics] = useState({
    total_subscribers: 0,
    mrr: 0,
    total_revenue: 0,
    pending_verifications: 0,
    verified_transactions: 0,
    free_readers: 0,
    total_users: 0,
    subscribers: [],
  });
  const [payments, setPayments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [adminNotesMap, setAdminNotesMap] = useState({});
  const [toastMessage, setToastMessage] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'transactions' | 'subscribers'

  // Payment settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({
    telebirr_phone: '',
    telebirr_name: '',
    cbe_account: '',
    cbe_name: '',
    etb_rate: 135.0,
    instructions: '',
  });

  // Receipt image zoom modal state
  const [zoomReceiptUrl, setZoomReceiptUrl] = useState(null);
  const [copiedRef, setCopiedRef] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const loadData = async () => {
    try {
      const [subData, payData, cfg] = await Promise.all([
        lorelyApi.adminGetSubscribers(accessToken).catch(() => ({})),
        lorelyApi.adminListPayments(null, accessToken).catch(() => []),
        lorelyApi.getPaymentConfig().catch(() => null),
      ]);
      if (subData) {
        setMetrics((prev) => ({ ...prev, ...subData }));
      }
      if (payData) {
        setPayments(payData);
      }
      if (cfg) {
        setPaymentConfig((prev) => ({ ...prev, ...cfg }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  const handleVerify = async (paymentId) => {
    setActionLoadingId(paymentId);
    try {
      const notes = adminNotesMap[paymentId] || 'Payment verified by administrator.';
      await lorelyApi.adminVerifyPayment(paymentId, notes, accessToken);
      showToast('Payment verified successfully! User plan has been upgraded.');
      await loadData();
    } catch (err) {
      showToast(`Verification failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (paymentId) => {
    const defaultReason = prompt('Reason for rejecting payment (optional):', 'Payment verification failed');
    if (defaultReason === null) return; // User cancelled prompt

    setActionLoadingId(paymentId);
    try {
      await lorelyApi.adminRejectPayment(paymentId, defaultReason, accessToken);
      showToast('Payment marked as rejected.');
      await loadData();
    } catch (err) {
      showToast(`Rejection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await lorelyApi.adminUpdatePaymentConfig(
        {
          telebirr_phone: paymentConfig.telebirr_phone,
          telebirr_name: paymentConfig.telebirr_name,
          cbe_account: paymentConfig.cbe_account,
          cbe_name: paymentConfig.cbe_name,
          etb_rate: parseFloat(paymentConfig.etb_rate) || 135.0,
          instructions: paymentConfig.instructions,
        },
        accessToken,
      );
      setPaymentConfig((prev) => ({ ...prev, ...updated }));
      setIsSettingsOpen(false);
      showToast('Payment settings and Ethiopian accounts saved successfully!');
    } catch (err) {
      showToast(`Failed to update settings: ${err.message || 'Server error'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedRef(id);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const formatAmount = (amount, currency) => {
    const curr = (currency || 'USD').toUpperCase();
    const numAmount = Number(amount || 0);
    if (curr === 'ETB') {
      return `${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
    }
    return `$${numAmount.toFixed(2)} USD`;
  };

  const renderMethodBadge = (method) => {
    switch (method) {
      case 'telebirr':
        return <span className="method-chip method-telebirr">🇪🇹 Telebirr</span>;
      case 'cbe':
        return <span className="method-chip method-cbe">🇪🇹 CBE Bank</span>;
      case 'paypal':
        return <span className="method-chip method-paypal">🅿️ PayPal</span>;
      case 'credit_card':
      default:
        return <span className="method-chip method-card">💳 Card</span>;
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const filteredPayments =
    filterStatus === 'all'
      ? payments
      : payments.filter((p) => p.status === filterStatus);

  return (
    <div className="admin-subscribers-view" data-testid="admin-subscribers">
      <header className="subscribers-header-line">
        <div>
          <h1 className="subscribers-title">Subscribers & Payment Verification</h1>
          <p className="subscribers-sub">
            Review user payment submissions, verify Telebirr/CBE receipts, configure payout accounts, and manage memberships.
          </p>
        </div>
        <div className="subscribers-header-actions">
          <button
            type="button"
            className="admin-config-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure Telebirr, CBE Bank details & ETB rate"
          >
            ⚙️ Ethiopian Payment Accounts
          </button>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </header>

      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          {toastMessage}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="subscribers-kpi-grid">
        <div className="kpi-card mrr-card">
          <div className="kpi-card-header">
            <span className="kpi-card-icon">💰</span>
            <span className="kpi-card-label">Monthly Recurring Revenue</span>
          </div>
          <div className="kpi-card-value">${(Number(metrics.mrr) || 0).toFixed(2)}</div>
          <div className="kpi-card-sub">from {metrics.total_subscribers} paid subscriber(s)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-icon">👑</span>
            <span className="kpi-card-label">Active Pro Subscribers</span>
          </div>
          <div className="kpi-card-value">{metrics.total_subscribers}</div>
          <div className="kpi-card-sub">
            {metrics.free_readers} free reader(s) registered
          </div>
        </div>

        <div className={`kpi-card ${metrics.pending_verifications > 0 ? 'kpi-card-alert' : ''}`}>
          <div className="kpi-card-header">
            <span className="kpi-card-icon">⏳</span>
            <span className="kpi-card-label">Pending Verifications</span>
          </div>
          <div className="kpi-card-value">{metrics.pending_verifications}</div>
          <div className="kpi-card-sub">
            {metrics.pending_verifications > 0
              ? 'Action required on pending orders'
              : 'All transactions cleared'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-icon">🇪🇹</span>
            <span className="kpi-card-label">ETB Exchange Rate</span>
          </div>
          <div className="kpi-card-value">{paymentConfig.etb_rate} ETB</div>
          <div className="kpi-card-sub">per $1.00 USD</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="subscribers-view-tabs">
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          ⚡ Verification Queue ({pendingPayments.length})
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          💳 All Transactions ({payments.length})
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'subscribers' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscribers')}
        >
          👥 Subscriber Roster ({metrics.subscribers?.length || 0})
        </button>
      </div>

      {/* SECTION 1: Verification Queue */}
      {activeTab === 'queue' && (
        <section className="admin-section-container">
          <div className="section-head">
            <h2>Pending Payment Verifications</h2>
            <p className="admin-subtext">
              Review user payment submissions and grant access to paid membership tiers. For Telebirr/CBE transfers, verify the reference ID and uploaded receipt screenshot.
            </p>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="queue-empty-state">
              <span className="empty-check-icon">✓</span>
              <h3>No Pending Verifications</h3>
              <p>All incoming payment submissions have been reviewed and approved.</p>
            </div>
          ) : (
            <div className="pending-cards-grid">
              {pendingPayments.map((p) => {
                const details = p.payment_details || {};
                const refNum = details.reference_number || details.billing_reference;
                const senderName = details.sender_name || details.cardholder_name;
                const senderPhone = details.sender_phone;
                const receiptImg = details.receipt_image;

                return (
                  <div key={p.id} className="pending-payment-card">
                    <div className="payment-card-top">
                      <div>
                        <h4 className="payment-user-name">{p.user_name}</h4>
                        <span className="payment-user-email">{p.user_email}</span>
                      </div>
                      <span className="payment-badge-pending">PENDING APPROVAL</span>
                    </div>

                    <div className="payment-specs-grid">
                      <div className="spec-item">
                        <span className="spec-label">Plan Tier</span>
                        <strong className="spec-value plan-name-highlight">
                          {p.plan_slug.toUpperCase()}
                        </strong>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Amount</span>
                        <strong className="spec-value price-highlight">
                          {formatAmount(p.amount, p.currency)}
                        </strong>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Payment Method</span>
                        <div className="spec-value">
                          {renderMethodBadge(p.payment_method)}
                          {details.last4 ? ` (•••• ${details.last4})` : ''}
                        </div>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Submission Date</span>
                        <span className="spec-value">
                          {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Payer / Reference Information */}
                    <div className="payment-details-box">
                      {senderName && (
                        <div className="detail-line">
                          <span className="detail-label">Sender / Cardholder:</span>
                          <strong>{senderName}</strong>
                        </div>
                      )}
                      {senderPhone && (
                        <div className="detail-line">
                          <span className="detail-label">Sender Phone:</span>
                          <strong>{senderPhone}</strong>
                        </div>
                      )}
                      {refNum && (
                        <div className="detail-line ref-line">
                          <span className="detail-label">Transaction Ref:</span>
                          <code className="ref-code">{refNum}</code>
                          <button
                            type="button"
                            className="ref-copy-btn"
                            onClick={() => copyToClipboard(refNum, p.id)}
                            title="Copy reference number"
                          >
                            {copiedRef === p.id ? '✓ Copied' : '📋 Copy'}
                          </button>
                        </div>
                      )}

                      {/* Receipt Screenshot Thumbnail */}
                      {receiptImg && (
                        <div className="receipt-preview-box">
                          <span className="detail-label">Payment Receipt:</span>
                          <div className="receipt-thumb-wrap" onClick={() => setZoomReceiptUrl(receiptImg)}>
                            <img
                              src={receiptImg}
                              alt="Receipt Screenshot"
                              className="receipt-thumbnail-img"
                            />
                            <span className="receipt-zoom-hint">🔍 Click to inspect receipt</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="payment-actions-area">
                      <input
                        type="text"
                        className="admin-note-input"
                        placeholder="Add verification notes (optional)..."
                        value={adminNotesMap[p.id] || ''}
                        onChange={(e) =>
                          setAdminNotesMap({ ...adminNotesMap, [p.id]: e.target.value })
                        }
                      />
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn-verify"
                          onClick={() => handleVerify(p.id)}
                          disabled={actionLoadingId === p.id}
                        >
                          {actionLoadingId === p.id ? 'Verifying...' : '✓ Verify & Upgrade'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => handleReject(p.id)}
                          disabled={actionLoadingId === p.id}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: All Transactions Ledger */}
      {activeTab === 'transactions' && (
        <section className="admin-section-container">
          <div className="transactions-filter-bar">
            <h2>Payment Transaction Ledger</h2>
            <div className="filter-buttons">
              {['all', 'pending', 'verified', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`filter-btn ${filterStatus === st ? 'active' : ''}`}
                  onClick={() => setFilterStatus(st)}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-telemetry-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Reader</th>
                  <th>Plan Tier</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference / Receipt</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#8CA898' }}>
                      No payment transactions found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const details = p.payment_details || {};
                    const refNum = details.reference_number || details.billing_reference;
                    const receiptImg = details.receipt_image;

                    return (
                      <tr key={p.id}>
                        <td>
                          <code className="tx-id-code">{p.id.slice(0, 8)}…</code>
                        </td>
                        <td>
                          <strong>{p.user_name}</strong>
                          <div className="table-sub-email">{p.user_email}</div>
                        </td>
                        <td>
                          <span className="table-plan-badge">{p.plan_slug}</span>
                        </td>
                        <td>
                          {renderMethodBadge(p.payment_method)}
                        </td>
                        <td>
                          <strong>{formatAmount(p.amount, p.currency)}</strong>
                        </td>
                        <td>
                          <div className="table-ref-cell">
                            {refNum ? <code className="table-ref-code">{refNum}</code> : '—'}
                            {receiptImg && (
                              <button
                                type="button"
                                className="table-receipt-btn"
                                onClick={() => setZoomReceiptUrl(receiptImg)}
                                title="Inspect receipt screenshot"
                              >
                                🖼️ View
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill pill-${p.status}`}>
                            {p.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="table-date">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td className="table-notes-cell">
                          {p.admin_notes || '—'}
                        </td>
                        <td>
                          {p.status === 'pending' ? (
                            <div className="inline-action-btns">
                              <button
                                type="button"
                                className="btn-table-verify"
                                onClick={() => handleVerify(p.id)}
                                disabled={actionLoadingId === p.id}
                                title="Verify payment"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="btn-table-reject"
                                onClick={() => handleReject(p.id)}
                                disabled={actionLoadingId === p.id}
                                title="Reject payment"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="tx-completed-label">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 3: Subscriber Roster */}
      {activeTab === 'subscribers' && (
        <section className="admin-section-container">
          <div className="section-head">
            <h2>Active Subscribers & Reader Allocations</h2>
            <p className="admin-subtext">
              View all readers, their current membership tiers, active plan status, and monthly billing values.
            </p>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-telemetry-table">
              <thead>
                <tr>
                  <th>Reader</th>
                  <th>Email</th>
                  <th>Current Plan</th>
                  <th>Monthly Value</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {metrics.subscribers?.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <strong>{sub.display_name}</strong>
                    </td>
                    <td>{sub.email}</td>
                    <td>
                      <span className={`plan-tier-pill tier-${sub.plan_tier || 'free'}`}>
                        {sub.plan_tier === 'institution'
                          ? '🏛️ Institution ($100)'
                          : sub.plan_tier === 'scholar'
                          ? '👑 Scholar ($20)'
                          : sub.plan_tier === 'go'
                          ? '⚡ Explorer ($5)'
                          : '📖 Free Reader'}
                      </span>
                    </td>
                    <td>
                      <strong>${(sub.price_monthly || 0).toFixed(2)}/mo</strong>
                    </td>
                    <td>
                      <span className="table-date">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: Ethiopian Payment Accounts Settings */}
      {isSettingsOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="admin-settings-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">⚙️ Ethiopian Payment Accounts</h3>
                <p className="modal-sub">
                  Configure your Telebirr & CBE details displayed to users during Ethiopian Birr (ETB) checkout.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="settings-form">
              <div className="form-section-title">🇪🇹 Telebirr Account Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tb-phone">Telebirr Phone Number</label>
                  <input
                    id="tb-phone"
                    type="text"
                    value={paymentConfig.telebirr_phone}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, telebirr_phone: e.target.value })
                    }
                    placeholder="+251 91 123 4567"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tb-name">Telebirr Account Holder Name</label>
                  <input
                    id="tb-name"
                    type="text"
                    value={paymentConfig.telebirr_name}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, telebirr_name: e.target.value })
                    }
                    placeholder="Dawit (Lorely Admin)"
                    required
                  />
                </div>
              </div>

              <div className="form-section-title">🏦 Commercial Bank of Ethiopia (CBE)</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cbe-acct">CBE Account Number</label>
                  <input
                    id="cbe-acct"
                    type="text"
                    value={paymentConfig.cbe_account}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, cbe_account: e.target.value })
                    }
                    placeholder="1000123456789"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cbe-name">CBE Account Holder Name</label>
                  <input
                    id="cbe-name"
                    type="text"
                    value={paymentConfig.cbe_name}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, cbe_name: e.target.value })
                    }
                    placeholder="Dawit (Lorely Admin)"
                    required
                  />
                </div>
              </div>

              <div className="form-section-title">💱 Currency Conversion Rate</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="etb-rate">Exchange Rate (1 USD to ETB)</label>
                  <input
                    id="etb-rate"
                    type="number"
                    step="0.1"
                    min="1"
                    value={paymentConfig.etb_rate}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, etb_rate: e.target.value })
                    }
                    placeholder="135.0"
                    required
                  />
                  <span className="field-hint">e.g. 135 means $20/mo plan is 2,700 ETB.</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="instructions">Payment Instructions for Users</label>
                <textarea
                  id="instructions"
                  rows="3"
                  value={paymentConfig.instructions}
                  onChange={(e) =>
                    setPaymentConfig({ ...paymentConfig, instructions: e.target.value })
                  }
                  placeholder="Instructions displayed to users..."
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save-settings"
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Saving...' : 'Save Payment Accounts'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receipt Screenshot Lightbox Zoom */}
      {zoomReceiptUrl && (
        <div className="receipt-lightbox-backdrop" onClick={() => setZoomReceiptUrl(null)}>
          <div className="receipt-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <span>🧾 Transfer Receipt Inspection</span>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => setZoomReceiptUrl(null)}
              >
                ✕
              </button>
            </div>
            <div className="lightbox-image-wrap">
              <img src={zoomReceiptUrl} alt="Enlarged Receipt" className="lightbox-image" />
            </div>
            <div className="lightbox-footer">
              <a
                href={zoomReceiptUrl}
                download="payment-receipt.png"
                className="btn-download-receipt"
              >
                ⬇️ Download Full Receipt
              </a>
              <button
                type="button"
                className="btn-close-lightbox"
                onClick={() => setZoomReceiptUrl(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
