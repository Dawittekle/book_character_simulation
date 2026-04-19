import React from 'react';
import '../../components/AppShell.css';

export default function Approvals() {
  const pendingApprovals = [
    { title: 'The Cinderella Play - End State Review', user: 'Mark Simmons', date: 'Just now' },
    { title: 'Hamlet - Extraction Metrics', user: 'Mark Simmons', date: '2 hours ago' }
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-breadcrumbs">
          <span>Dawit Teklebrhan Team</span>
          <span>/</span>
          <span>Manager</span>
        </div>
        <h1>Pending Approvals</h1>
        <p>Review, comment on, or reject simulation results submitted by your team.</p>
      </section>

      <section className="dashboard-grid-section">
         {pendingApprovals.map((item, i) => (
             <article key={i} className="surface-card" style={{ padding: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{item.title}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submitted by {item.user} • {item.date}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="primary-button" style={{ padding: '0.5rem 1rem', minHeight: '0' }}>Approve</button>
                  <button className="secondary-button" style={{ padding: '0.5rem 1rem', minHeight: '0' }}>Review</button>
                </div>
             </article>
         ))}
      </section>
    </div>
  );
}
