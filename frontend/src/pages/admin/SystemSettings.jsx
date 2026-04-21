import React from 'react';
import '../../components/AppShell.css';

export default function SystemSettings() {
  return (
    <div className="dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-breadcrumbs">
          <span>Dawit Teklebrhan Team</span>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1>System Settings</h1>
        <p>Manage platform billing, storage configurations, and active integrations.</p>
      </section>

      <section style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
        <article className="surface-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1.4rem', marginBottom: '1rem' }}>Billing & Usage</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Current tier allows up to 50 active simulations and 100k generated tokens per month.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="primary-button">Upgrade plan</button>
            <button className="secondary-button">View invoices</button>
          </div>
        </article>

        <article className="surface-card" style={{ padding: '2rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1.4rem', marginBottom: '1rem' }}>Default LLM Provider</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Select the default provider assigned to newly created workspace simulations.
          </p>
          <select style={{ maxWidth: '300px', cursor: 'pointer' }}>
            <option>Gemini 1.5 Pro</option>
            <option>OpenAI GPT-4o</option>
          </select>
        </article>
      </section>
    </div>
  );
}
