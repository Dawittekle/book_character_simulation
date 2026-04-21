import React from 'react';
import '../../components/AppShell.css';

export default function TeamAnalytics() {
  return (
    <div className="dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-breadcrumbs">
          <span>Dawit Teklebrhan Team</span>
          <span>/</span>
          <span>Manager</span>
        </div>
        <h1>Team Analytics</h1>
        <p>Review simulation metrics, export reports, and trace emotional alignment parameters for your workspace.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <article className="surface-card" style={{ padding: '1.5rem' }}>
          <span className="section-eyebrow">Active Simulators</span>
          <strong style={{ display: 'block', margin: '0.5rem 0', fontSize: '2.5rem', color: 'var(--text-strong)' }}>12</strong>
          <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>↗ +2 this week</span>
        </article>

        <article className="surface-card" style={{ padding: '1.5rem' }}>
          <span className="section-eyebrow">Exported Reports</span>
          <strong style={{ display: 'block', margin: '0.5rem 0', fontSize: '2.5rem', color: 'var(--text-strong)' }}>45</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Last 30 days</span>
        </article>
      </section>
      
      <section className="surface-card" style={{ padding: '2rem', minHeight: '300px', display: 'grid', placeItems: 'center' }}>
         <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '1rem' }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <p>Interactive charts will render here once telemetry hooks are integrated.</p>
         </div>
      </section>
    </div>
  );
}
