import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminPlans.css';

const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free Reader',
    price_monthly: 0,
    book_quota: 3,
    daily_messages: 20,
    voice_access: false,
    description: 'Exploration tier with access to standard classics and introductory character dialogues.',
    features: ['3 Personal Books', '20 Daily Dialogues', 'Text Conversations', 'Community Support'],
  },
  {
    id: 'scholar',
    name: 'Literary Scholar',
    price_monthly: 9.99,
    book_quota: 'Unlimited',
    daily_messages: 'Unlimited',
    voice_access: true,
    description: 'Unlimited shelf imports, interactive speech synthesis, and full cognitive memory evolution.',
    features: ['Unlimited Book Shelf', 'Unlimited Messages', 'HD Voice Simulation', 'Character Memory Sync', 'Priority Vector Indexing'],
  },
  {
    id: 'institution',
    name: 'Institutional Archive',
    price_monthly: 49.00,
    book_quota: 'Unlimited',
    daily_messages: 'Unlimited',
    voice_access: true,
    description: 'Dedicated vector search namespace, multi-seat classroom access, and custom prompt fine-tuning.',
    features: ['Multi-seat Library Access', 'Isolated Vector Namespace', 'Custom Persona Directives', 'LMS Integration', '24/7 Dedicated Support'],
  },
];

// Storage helpers to instantly render cached plans and allocations without layout flicker
const getStoredAdminData = (key) => {
  try {
    const raw = sessionStorage.getItem(`lorely_admin_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setStoredAdminData = (key, data) => {
  try {
    sessionStorage.setItem(`lorely_admin_${key}`, JSON.stringify(data));
  } catch {}
};

export default function AdminPlans() {
  const { accessToken } = useOutletContext();
  const cachedPlans = getStoredAdminData('plans');
  const cachedUsers = getStoredAdminData('users');

  const [plans, setPlans] = useState(cachedPlans || DEFAULT_PLANS);
  const [users, setUsers] = useState(cachedUsers || []);
  const [loading, setLoading] = useState(!cachedUsers || cachedUsers.length === 0);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [plansRes, usersRes] = await Promise.all([
          lorelyApi.adminGetPlans(accessToken).catch(() => ({ plans: DEFAULT_PLANS })),
          lorelyApi.adminListUsers(accessToken).catch(() => []),
        ]);
        if (mounted) {
          if (plansRes?.plans?.length) {
            const mappedPlans = plansRes.plans.map((p) => ({
              ...p,
              features: DEFAULT_PLANS.find((dp) => dp.id === p.id)?.features || [
                `Book quota: ${p.book_quota}`,
                `Daily messages: ${p.daily_messages}`,
              ],
            }));
            setPlans(mappedPlans);
            setStoredAdminData('plans', mappedPlans);
          }
          if (usersRes && Array.isArray(usersRes)) {
            setUsers(usersRes);
            setStoredAdminData('users', usersRes);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handlePlanChange = async (userId, newPlan) => {
    setUpdatingUserId(userId);
    setStatusMessage('');
    try {
      await lorelyApi.adminUpdateUserPlan(userId, newPlan, accessToken);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan_tier: newPlan } : u))
      );
      setStatusMessage('Plan updated successfully.');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update plan.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan({
      ...plan,
      featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
    });
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSavingPlan(true);
    setStatusMessage('');
    try {
      const payload = {
        name: editingPlan.name,
        price_monthly: parseFloat(editingPlan.price_monthly) || 0,
        book_quota: String(editingPlan.book_quota),
        daily_messages: String(editingPlan.daily_messages),
        voice_access: Boolean(editingPlan.voice_access),
        description: editingPlan.description,
        badge: editingPlan.badge || null,
        features: editingPlan.featuresText
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      };

      const res = await lorelyApi.adminUpdatePlan(editingPlan.id, payload, accessToken);
      const updated = res.plan;
      setPlans((prev) =>
        prev.map((p) =>
          p.id === editingPlan.id ? { ...p, ...updated, features: payload.features } : p
        )
      );
      setStatusMessage(`Plan '${editingPlan.name}' updated successfully in the database.`);
      setEditingPlan(null);
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="admin-plans-view" data-testid="admin-plans">
      <header className="plans-header-line">
        <div>
          <h1 className="plans-title">Membership Plans & Quota Management</h1>
          <p className="plans-sub">
            Oversee subscription tiers, character dialogue allowances, voice access, and reader quota allocations.
          </p>
        </div>
      </header>

      {statusMessage && (
        <div className="plans-status-toast" role="status">
          {statusMessage}
        </div>
      )}

      {/* Plan Tier Cards */}
      <div className="plans-tier-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan-card ${plan.id === 'scholar' ? 'featured-plan' : ''}`}>
            {plan.id === 'scholar' && <span className="plan-badge">Most Popular</span>}
            <h3 className="plan-card-name">{plan.name}</h3>
            <div className="plan-pricing">
              <span className="price-amount">${plan.price_monthly}</span>
              <span className="price-period">/ month</span>
            </div>
            <p className="plan-card-desc">{plan.description}</p>

            <div className="plan-quotas-box">
              <div className="quota-row">
                <span>Books:</span>
                <strong>{plan.book_quota}</strong>
              </div>
              <div className="quota-row">
                <span>Daily Turns:</span>
                <strong>{plan.daily_messages}</strong>
              </div>
              <div className="quota-row">
                <span>Voice Mode:</span>
                <strong>{plan.voice_access ? 'Enabled (HD)' : 'Standard'}</strong>
              </div>
            </div>

            <ul className="plan-feature-list">
              {plan.features?.map((f, i) => (
                <li key={i}>✓ {f}</li>
              ))}
            </ul>

            <button
              type="button"
              className="btn-edit-plan"
              onClick={() => handleOpenEdit(plan)}
            >
              ✏️ Edit Plan Details
            </button>
          </div>
        ))}
      </div>

      {/* User Allocations Section */}
      <section className="plans-user-section">
        <h2 className="plans-section-heading">Reader Tier Allocations</h2>
        <p className="plans-section-sub">
          Assign membership tiers and custom quota packages to active readers.
        </p>

        <div className="admin-table-wrapper">
          <table className="admin-telemetry-table">
            <thead>
              <tr>
                <th>Reader</th>
                <th>Email</th>
                <th>Current Tier</th>
                <th>Assigned Books</th>
                <th>Modify Tier</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                // Elegant skeleton rows matching character gallery / user library
                [1, 2, 3].map((n) => (
                  <tr key={`skeleton-user-${n}`} className="skeleton-table-row">
                    <td><div className="skeleton-line-cell medium" /></td>
                    <td><div className="skeleton-line-cell long" /></td>
                    <td><div className="skeleton-pill-cell" /></td>
                    <td><div className="skeleton-line-cell short" /></td>
                    <td><div className="skeleton-line-cell medium" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#8CA898' }}>
                    No readers registered in database yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.display_name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`plan-tier-pill tier-${u.plan_tier || 'scholar'}`}>
                        {u.plan_tier === 'institution'
                          ? '🏛️ Archive'
                          : u.plan_tier === 'scholar'
                          ? '👑 Scholar'
                          : '📖 Free'}
                      </span>
                    </td>
                    <td>{u.book_count ?? 0}</td>
                    <td>
                      <select
                        value={u.plan_tier || 'scholar'}
                        onChange={(e) => handlePlanChange(u.id, e.target.value)}
                        disabled={updatingUserId === u.id}
                        className="plan-select-dropdown"
                      >
                        <option value="free">Free Reader</option>
                        <option value="scholar">Literary Scholar</option>
                        <option value="institution">Institutional Archive</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="plan-modal-backdrop" onClick={() => setEditingPlan(null)}>
          <div
            className="plan-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="plan-modal-header">
              <h3>Edit Plan: {editingPlan.name}</h3>
              <button
                type="button"
                className="plan-modal-close"
                onClick={() => setEditingPlan(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="plan-modal-form">
              <div className="modal-form-row">
                <div className="modal-field">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, name: e.target.value })
                    }
                  />
                </div>
                <div className="modal-field">
                  <label>Monthly Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingPlan.price_monthly}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, price_monthly: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-form-row">
                <div className="modal-field">
                  <label>Book Quota</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.book_quota}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, book_quota: e.target.value })
                    }
                  />
                </div>
                <div className="modal-field">
                  <label>Daily Dialogue Turns</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.daily_messages}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, daily_messages: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan.voice_access)}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, voice_access: e.target.checked })
                    }
                  />
                  <span>Voice Simulation Mode Enabled (HD)</span>
                </label>
              </div>

              <div className="modal-field">
                <label>Plan Description</label>
                <textarea
                  rows="2"
                  value={editingPlan.description}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, description: e.target.value })
                  }
                />
              </div>

              <div className="modal-field">
                <label>Features List (one feature per line)</label>
                <textarea
                  rows="4"
                  value={editingPlan.featuresText || ''}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, featuresText: e.target.value })
                  }
                  placeholder="Unlimited text chat&#10;HD Voice Mode&#10;Priority RAG"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setEditingPlan(null)}
                  disabled={savingPlan}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn-save"
                  disabled={savingPlan}
                >
                  {savingPlan ? 'Saving to Database...' : 'Save Plan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
