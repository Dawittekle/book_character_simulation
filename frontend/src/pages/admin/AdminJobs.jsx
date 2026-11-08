import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminJobs.css';

export default function AdminJobs() {
  const { accessToken } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('status') || 'all';

  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadJobs() {
      setLoading(true);
      try {
        const queryStatus = filter === 'all' ? null : filter;
        const list = await lorelyApi.adminListJobs(queryStatus, accessToken);
        if (mounted) setJobs(list);
      } catch (err) {
        // Fall back gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadJobs();
    return () => {
      mounted = false;
    };
  }, [filter, accessToken]);

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setSearchParams(nextFilter === 'all' ? {} : { status: nextFilter });
  };

  const handleRetryJob = async (jobId) => {
    setRetryingId(jobId);
    try {
      await lorelyApi.adminRetryJob(jobId, accessToken);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'queued', stage: 'retrying', error_message: null } : j)),
      );
    } catch (err) {
      // Error handling
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="admin-jobs-view" data-testid="admin-jobs">
      <header className="jobs-header-line">
        <div>
          <h1 className="jobs-title">Background Extraction Telemetry</h1>
          <p className="jobs-sub">
            Monitor real-time parsing, semantic chunking, and character extraction jobs across the pipeline.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="jobs-filter-group">
          {['all', 'failed', 'processing', 'completed'].map((f) => (
            <button
              key={f}
              type="button"
              className={`job-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => handleFilterChange(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <p className="admin-subtext">Loading jobs telemetry...</p>
      ) : jobs.length === 0 ? (
        <p className="admin-subtext">No jobs found matching "{filter}".</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-telemetry-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Title / Inferred</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Error Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
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
                  <td className="error-cell">
                    {job.error_message ? (
                      <span className="error-text" title={job.error_message}>
                        {job.error_message.slice(0, 45)}...
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        className="job-retry-btn"
                        disabled={retryingId === job.id}
                        onClick={() => handleRetryJob(job.id)}
                      >
                        {retryingId === job.id ? 'Retrying...' : '↻ Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
