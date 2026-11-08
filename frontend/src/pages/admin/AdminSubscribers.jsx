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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const loadData = async () => {
    try {
      const [subData, payData] = await Promise.all([
        lorelyApi.adminGetSubscribers(accessToken).catch(() => ({})),
        lorelyApi.adminListPayments(null, accessToken).catch(() => []),
      ]);
      if (subData) {
        setMetrics((prev) => ({ ...prev, ...subData }));
      }
      if (payData) {
        setPayments(payData);
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
            Review user payment submissions, approve membership upgrades, inspect AI model assignments, and oversee subscription revenue.
          </p>
        </div>
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
          <div className="kpi-card-value">${metrics.mrr.toFixed(2)}</div>
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
            <span className="kpi-card-icon">📜</span>
            <span className="kpi-card-label">Total Verified Revenue</span>
          </div>
          <div className="kpi-card-value">${metrics.total_revenue.toFixed(2)}</div>
          <div className="kpi-card-sub">
            {metrics.verified_transactions} total approved transaction(s)
          </div>
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
              Review user payment submissions and grant access to paid membership tiers and chosen AI frontier models.
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
              {pendingPayments.map((p) => (
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
                      <strong className="spec-value price-highlight">${p.amount.toFixed(2)} {p.currency}</strong>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">Assigned AI Model</span>
                      <strong className="spec-value model-badge">
                        {p.chosen_model === 'gemini-2.5-pro' ? '🧠 Gemini 2.5 Pro' : '⚡ Gemini 3.5 Flash'}
                      </strong>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">Payment Method</span>
                      <span className="spec-value">
                        {p.payment_method === 'credit_card' ? '💳 Credit Card' : p.payment_method}
                        {p.payment_details?.last4 ? ` (•••• ${p.payment_details.last4})` : ''}
                      </span>
                    </div>
                  </div>

                  {p.payment_details?.cardholder_name && (
                    <div className="payment-cardholder-row">
                      <span>Cardholder: <strong>{p.payment_details.cardholder_name}</strong></span>
                      {p.payment_details?.billing_reference && (
                        <span>Ref: <em>{p.payment_details.billing_reference}</em></span>
                      )}
                      <span className="submission-date">
                        Submitted: {new Date(p.created_at).toLocaleString()}
                      </span>
                    </div>
                  )}

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
              ))}
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
                  <th>Model</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#8CA898' }}>
                      No payment transactions found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
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
                        <span className="table-model-badge">
                          {p.chosen_model === 'gemini-2.5-pro' ? '🧠 Pro' : '⚡ Flash'}
                        </span>
                      </td>
                      <td>
                        <strong>${p.amount.toFixed(2)}</strong>
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
                  ))
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
              View all readers, their current membership tiers, active AI models, and estimated monthly plan value.
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
                  <th>Assigned Model</th>
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
                      <span className="table-model-badge">
                        {sub.active_model === 'gemini-2.5-pro' ? '🧠 Gemini 2.5 Pro' : '⚡ Gemini 3.5 Flash'}
                      </span>
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
    </div>
  );
}
