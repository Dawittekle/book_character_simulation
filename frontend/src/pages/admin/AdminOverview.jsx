import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminOverview.css';

export default function AdminOverview() {
  const { accessToken } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      </div>
    );
  }

  const counts = data?.counts || {};
  const recentJobs = data?.recent_jobs || [];

  return (
    <div className="admin-overview-view" data-testid="admin-overview">
      <header className="overview-header-row">
        <div>
          <h1 className="overview-title">System Health & Telemetry</h1>
          <p className="overview-sub">
            Authoritative status across Postgres cloud persistence, LLM extraction pipelines, and active readers.
          </p>
        </div>

        <div className="system-status-indicator">
          <span className="status-indicator-dot" />
          <span className="status-indicator-text">All Services Operational</span>
        </div>
      </header>

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
