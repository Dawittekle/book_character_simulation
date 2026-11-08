import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminOverview.css';

export default function AdminOverview() {
  const { accessToken } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastToast, setBroadcastToast] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetchOverview() {
      try {
        const res = await lorelyApi.getAdminOverview(accessToken);
        if (mounted) setData(res);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load admin overview');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchOverview();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="admin-loading-indicator">
        <div className="admin-spinner" />
        <p>Loading real-time operational telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-box">
        <h3>Operational Error</h3>
        <p>{error}</p>
        {(error.includes('Administrator privileges') || error.includes('403') || error.includes('401')) && (
          <button
            type="button"
            className="admin-login-retry-btn"
            style={{
              marginTop: '12px',
              background: '#233B2E',
              border: '1px solid #325240',
              color: '#C89D5C',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onClick={() => {
              lorelyApi.adminLogout();
              navigate('/admin/login');
            }}
          >
            Sign In with Administrator Credentials →
          </button>
        )}
      </div>
    );
  }

  const counts = data?.counts || {};
  const recentJobs = data?.recent_jobs || [];

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      await lorelyApi.adminBroadcastNotification(
        {
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          category: 'admin_broadcast',
          link_url: '/',
        },
        accessToken,
      );
      setBroadcastTitle('');
      setBroadcastMessage('');
      setIsBroadcastOpen(false);
      setBroadcastToast('Broadcast sent successfully to all readers.');
      setTimeout(() => setBroadcastToast(''), 4000);
    } catch (err) {
      setBroadcastToast(err.message || 'Failed to send broadcast.');
    }
  };

  return (
    <div className="admin-overview-view" data-testid="admin-overview">
      <header className="overview-header-row">
        <div>
          <h1 className="overview-title">System Health & Telemetry</h1>
          <p className="overview-sub">
            Authoritative status across Postgres cloud persistence, LLM extraction pipelines, and active readers.
          </p>
        </div>

        <div className="header-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            className="admin-broadcast-trigger-btn"
            onClick={() => setIsBroadcastOpen(true)}
            style={{
              background: '#C89D5C',
              color: '#14241B',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📢 Broadcast to Readers
          </button>

          <div className="system-status-indicator">
            <span className="status-indicator-dot" />
            <span className="status-indicator-text">All Services Operational</span>
          </div>
        </div>
      </header>

      {broadcastToast && (
        <div className="broadcast-toast" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#86EFAC', padding: '10px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {broadcastToast}
        </div>
      )}

      {isBroadcastOpen && (
        <div className="broadcast-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="broadcast-modal" style={{ background: '#14241B', border: '1px solid #233B2E', borderRadius: '12px', padding: '24px', width: '450px', maxWidth: '90vw', color: '#FAF7F2' }}>
            <h3 style={{ fontFamily: 'Cinzel, Georgia, serif', margin: '0 0 12px', fontSize: '18px' }}>📢 Broadcast Reader Announcement</h3>
            <p style={{ fontSize: '12px', color: '#8CA898', margin: '0 0 16px' }}>This notification will immediately appear in the bell dropdown for all active readers.</p>
            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8CA898', display: 'block', marginBottom: '4px' }}>Headline</label>
                <input
                  type="text"
                  placeholder="e.g. New Masterpiece Added to Library"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: '#0D1912', border: '1px solid #325240', borderRadius: '6px', color: '#FAF7F2' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8CA898', display: 'block', marginBottom: '4px' }}>Message Body</label>
                <textarea
                  rows={3}
                  placeholder="Detail the update, author addition, or new character..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', background: '#0D1912', border: '1px solid #325240', borderRadius: '6px', color: '#FAF7F2' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  style={{ background: 'none', border: '1px solid #325240', color: '#D3DFD7', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#C89D5C', color: '#14241B', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Send Announcement →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <span className="metric-icon">👥</span>
          <div className="metric-info">
            <span className="metric-value">{counts.users ?? 0}</span>
            <span className="metric-label">Registered Readers</span>
          </div>
        </div>

        <div className="admin-metric-card" onClick={() => navigate('/admin/catalog')} role="button" tabIndex={0}>
          <span className="metric-icon">📚</span>
          <div className="metric-info">
            <span className="metric-value">{counts.books ?? 0}</span>
            <span className="metric-label">Catalogue Works</span>
          </div>
        </div>

        <div className="admin-metric-card">
          <span className="metric-icon">🎭</span>
          <div className="metric-info">
            <span className="metric-value">{counts.characters ?? 0}</span>
            <span className="metric-label">Simulated Characters</span>
          </div>
        </div>

        <div className="admin-metric-card">
          <span className="metric-icon">💬</span>
          <div className="metric-info">
            <span className="metric-value">{counts.conversations ?? 0}</span>
            <span className="metric-label">Reader Conversations</span>
          </div>
        </div>

        <div className="admin-metric-card" onClick={() => navigate('/admin/jobs')} role="button" tabIndex={0}>
          <span className="metric-icon">⚡</span>
          <div className="metric-info">
            <span className="metric-value">{counts.active_jobs ?? 0}</span>
            <span className="metric-label">Active Extraction Jobs</span>
          </div>
        </div>

        <div className="admin-metric-card" onClick={() => navigate('/admin/jobs?status=failed')} role="button" tabIndex={0}>
          <span className="metric-icon">⚠️</span>
          <div className="metric-info">
            <span className={`metric-value ${counts.failed_jobs > 0 ? 'text-amber' : ''}`}>
              {counts.failed_jobs ?? 0}
            </span>
            <span className="metric-label">Failed Ingestion Jobs</span>
          </div>
        </div>
      </div>

      {/* Recent Jobs Section */}
      <section className="overview-recent-jobs-section">
        <div className="section-title-line">
          <h2 className="section-heading">Recent Document Extraction Jobs</h2>
          <button
            type="button"
            className="view-all-jobs-btn"
            onClick={() => navigate('/admin/jobs')}
          >
            Manage Queue →
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <p className="no-jobs-text">No processing jobs recorded yet.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-telemetry-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Title</th>
                  <th>Classification</th>
                  <th>Stage</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="code-font">{job.id.slice(0, 8)}...</td>
                    <td>{job.inferred_title || 'Untitled'}</td>
                    <td>
                      <span className="type-badge">{job.document_type || 'book'}</span>
                    </td>
                    <td>{job.stage}</td>
                    <td>
                      <div className="table-progress-bar">
                        <div
                          className="table-progress-fill"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-${job.status}`}>
                        {job.status}
                      </span>
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
