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

export default function AdminPlans() {
  const { accessToken } = useOutletContext();
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

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
            setPlans(
              plansRes.plans.map((p) => ({
                ...p,
                features: DEFAULT_PLANS.find((dp) => dp.id === p.id)?.features || [
                  `Book quota: ${p.book_quota}`,
                  `Daily messages: ${p.daily_messages}`,
                ],
              }))
            );
          }
          if (usersRes) setUsers(usersRes);
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
          </div>
        ))}
      </div>

      {/* User Allocations Section */}
      <section className="plans-user-section">
        <h2 className="plans-section-heading">Reader Tier Allocations</h2>
        <p className="plans-section-sub">
          Assign membership tiers and custom quota packages to active readers.
        </p>

        {loading ? (
          <p className="admin-subtext">Loading user plan allocations...</p>
        ) : (
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
                {users.map((u) => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
