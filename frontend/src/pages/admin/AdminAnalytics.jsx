import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import { getCharacterAvatarUrl } from '../../lib/formatters';
import './AdminAnalytics.css';

export default function AdminAnalytics() {
  const { accessToken } = useOutletContext();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const navigate = useNavigate();

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await lorelyApi.getAdminAnalytics(accessToken);
      setAnalytics(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch platform telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [accessToken]);

  if (loading && !analytics) {
    return (
      <div className="analytics-loading-box" data-testid="analytics-loading">
        <div className="analytics-spinner" />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="analytics-error-box" data-testid="analytics-error">
        <span className="analytics-error-icon">⚠️</span>
        <h3>Operational Telemetry Unavailable</h3>
        <p>{error}</p>
        <button
          type="button"
          className="analytics-retry-btn"
          onClick={() => {
            if (error.includes('Administrator privileges') || error.includes('403')) {
              lorelyApi.adminLogout();
              navigate('/admin/login');
            } else {
              loadAnalytics();
            }
          }}
        >
          {error.includes('Administrator privileges') || error.includes('403')
            ? 'Sign in to Admin Portal →'
            : 'Retry Connection'}
        </button>
      </div>
    );
  }

  const {
    character_engagement = [],
    plan_distribution = { free: 0, scholar: 0, institution: 0 },
    telemetry = {},
    timeline = [],
  } = analytics || {};

  const totalPlans =
    (plan_distribution.free || 0) +
    (plan_distribution.scholar || 0) +
    (plan_distribution.institution || 0) || 1;

  const freePct = Math.round(((plan_distribution.free || 0) / totalPlans) * 100);
  const scholarPct = Math.round(((plan_distribution.scholar || 0) / totalPlans) * 100);
  const institutionPct = Math.round(((plan_distribution.institution || 0) / totalPlans) * 100);

  // Maximum messages for relative progress bar widths
  const maxMessages = Math.max(...character_engagement.map((c) => c.messages_count), 1);

  // SVG Spline Area Calculations
  const chartWidth = 640;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const getPoints = (key) => {
    if (!timeline.length) return '';
    const step = (chartWidth - paddingX * 2) / Math.max(timeline.length - 1, 1);
    return timeline
      .map((item, idx) => {
        const x = paddingX + idx * step;
        const val = item[key] ?? 50;
        const y = chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getAreaPath = (key) => {
    if (!timeline.length) return '';
    const step = (chartWidth - paddingX * 2) / Math.max(timeline.length - 1, 1);
    const coords = timeline.map((item, idx) => {
      const x = paddingX + idx * step;
      const val = item[key] ?? 50;
      const y = chartHeight - paddingY - (val / 100) * (chartHeight - paddingY * 2);
      return { x, y };
    });

    const first = coords[0];
    const last = coords[coords.length - 1];
    const baseline = chartHeight - paddingY;

    let path = `M ${first.x} ${baseline} L ${first.x} ${first.y}`;
    for (let i = 1; i < coords.length; i++) {
      path += ` L ${coords[i].x} ${coords[i].y}`;
    }
    path += ` L ${last.x} ${baseline} Z`;
    return path;
  };

  return (
    <div className="lorely-analytics-page" data-testid="admin-analytics-page">
      {/* Page Header */}
      <header className="analytics-header">
        <div className="analytics-title-col">
          <div className="analytics-badge-row">
            <span className="live-pulse-dot" />
            <span className="analytics-badge-tag">Real-Time Cognitive Telemetry</span>
          </div>
          <h1 className="analytics-title">Literary Analytics & Deep Telemetry</h1>
          <p className="analytics-subtitle">
            Psychological state drift, dialogue throughput, and vector search performance across all readers.
          </p>
        </div>

        <div className="analytics-controls">
          <div className="timeframe-toggle-group">
            <button
              type="button"
              className={`timeframe-btn ${timeframe === '7d' ? 'active' : ''}`}
              onClick={() => setTimeframe('7d')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`timeframe-btn ${timeframe === '30d' ? 'active' : ''}`}
              onClick={() => setTimeframe('30d')}
            >
              30 Days
            </button>
            <button
              type="button"
              className={`timeframe-btn ${timeframe === 'all' ? 'active' : ''}`}
              onClick={() => setTimeframe('all')}
            >
              All Time
            </button>
          </div>

          <button
            type="button"
            className="analytics-refresh-btn"
            onClick={loadAnalytics}
            title="Refresh telemetry"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <section className="analytics-kpi-grid">
        <div className="telemetry-kpi-card">
          <div className="kpi-icon-row">
            <span className="kpi-icon">📚</span>
            <span className="kpi-trend positive">+100% Featured</span>
          </div>
          <div className="kpi-value">{telemetry.total_books ?? 0}</div>
          <div className="kpi-label">Literary Classics</div>
          <div className="kpi-detail">Fyodor Dostoevsky Complete Shelf</div>
        </div>

        <div className="telemetry-kpi-card">
          <div className="kpi-icon-row">
            <span className="kpi-icon">🧩</span>
            <span className="kpi-trend positive">91.2% Cosine Sim</span>
          </div>
          <div className="kpi-value">{telemetry.total_vector_chunks || 0}</div>
          <div className="kpi-label">Indexed Vector Chunks</div>
          <div className="kpi-detail">Chroma DB Spoiler-Gated Namespace</div>
        </div>

        <div className="telemetry-kpi-card">
          <div className="kpi-icon-row">
            <span className="kpi-icon">💬</span>
            <span className="kpi-trend positive">Live Conversations</span>
          </div>
          <div className="kpi-value">{telemetry.total_messages || 0}</div>
          <div className="kpi-label">Total Messages Exchanged</div>
          <div className="kpi-detail">Interactive Cognitive Turns</div>
        </div>

        <div className="telemetry-kpi-card">
          <div className="kpi-icon-row">
            <span className="kpi-icon">⚡</span>
            <span className="kpi-trend neutral">{telemetry.avg_retrieval_latency_ms ?? 0}ms</span>
          </div>
          <div className="kpi-value">{telemetry.llm_provider?.toUpperCase() || 'GEMINI'}</div>
          <div className="kpi-label">Active Inference Engine</div>
          <div className="kpi-detail">{telemetry.llm_model || 'gemini-3.5-flash'}</div>
        </div>
      </section>

      {/* Two Column Visual Grid */}
      <div className="analytics-main-grid">
        {/* Left Column: Emotion Drift Spline Chart */}
        <section className="analytics-surface-card spline-card">
          <div className="surface-card-header">
            <div>
              <h2 className="surface-card-title">Cognitive Emotion Drift Timeline</h2>
              <p className="surface-card-sub">
                Aggregate psychological trajectories simulated across active dialogues.
              </p>
            </div>
            <div className="spline-legend">
              <span className="legend-chip chip-hope">
                <span className="legend-indicator" /> Hope
              </span>
              <span className="legend-chip chip-longing">
                <span className="legend-indicator" /> Longing
              </span>
              <span className="legend-chip chip-anxiety">
                <span className="legend-indicator" /> Melancholy
              </span>
            </div>
          </div>

          <div className="svg-chart-container">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="analytics-spline-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="hopeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="longingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4d23" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4d23" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="anxietyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#F87171" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[25, 50, 75].map((level) => {
                const y = chartHeight - paddingY - (level / 100) * (chartHeight - paddingY * 2);
                return (
                  <g key={level}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 4}
                      fill="rgba(255,255,255,0.3)"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {level}%
                    </text>
                  </g>
                );
              })}

              {/* Area fills */}
              <path d={getAreaPath('hope')} fill="url(#hopeGrad)" />
              <path d={getAreaPath('longing')} fill="url(#longingGrad)" />
              <path d={getAreaPath('anxiety')} fill="url(#anxietyGrad)" />

              {/* Spline Lines */}
              <polyline
                fill="none"
                stroke="#34D399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={getPoints('hope')}
              />
              <polyline
                fill="none"
                stroke="#ef4d23"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={getPoints('longing')}
              />
              <polyline
                fill="none"
                stroke="#F87171"
                strokeWidth="2"
                strokeDasharray="5 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={getPoints('anxiety')}
              />

              {/* Data points & X axis labels */}
              {timeline.map((item, idx) => {
                const step = (chartWidth - paddingX * 2) / Math.max(timeline.length - 1, 1);
                const x = paddingX + idx * step;
                const hopeY =
                  chartHeight - paddingY - (item.hope / 100) * (chartHeight - paddingY * 2);

                return (
                  <g key={item.day} className="chart-node-group">
                    <circle
                      cx={x}
                      cy={hopeY}
                      r="4.5"
                      fill="#0b0f1a"
                      stroke="#34D399"
                      strokeWidth="2"
                      className="interactive-node"
                      onMouseEnter={() => setHoveredPoint(item)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    <text
                      x={x}
                      y={chartHeight - 10}
                      fill="rgba(255,255,255,0.45)"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {item.day}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredPoint && (
              <div className="chart-tooltip">
                <strong>{hoveredPoint.day} Telemetry</strong>
                <div className="tooltip-row">
                  <span>Hope:</span>
                  <span style={{ color: '#34D399' }}>{hoveredPoint.hope}%</span>
                </div>
                <div className="tooltip-row">
                  <span>Longing:</span>
                  <span style={{ color: '#ef4d23' }}>{hoveredPoint.longing}%</span>
                </div>
                <div className="tooltip-row">
                  <span>Melancholy:</span>
                  <span style={{ color: '#F87171' }}>{hoveredPoint.anxiety}%</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Reader Tier Breakdown */}
        <section className="analytics-surface-card plan-distribution-card">
          <div className="surface-card-header">
            <div>
              <h2 className="surface-card-title">Reader Tier Distribution</h2>
              <p className="surface-card-sub">Active subscription allocations across reader base.</p>
            </div>
          </div>

          <div className="radial-plan-layout">
            <div className="radial-gauge-wrapper">
              <svg viewBox="0 0 120 120" className="radial-donut-svg">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#182032"
                  strokeWidth="12"
                />
                {/* Scholar Segment */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#ef4d23"
                  strokeWidth="12"
                  strokeDasharray={`${(scholarPct * 301.6) / 100} 301.6`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                {/* Free Segment */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="12"
                  strokeDasharray={`${(freePct * 301.6) / 100} 301.6`}
                  strokeDashoffset={`-${(scholarPct * 301.6) / 100}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="radial-center-stats">
                <span className="radial-total">{telemetry.total_users ?? 0}</span>
                <span className="radial-label">Readers</span>
              </div>
            </div>

            <div className="radial-legend-list">
              <div className="radial-legend-item">
                <div className="legend-dot-label">
                  <span className="plan-dot dot-scholar" />
                  <strong>Literary Scholar ($9.99/mo)</strong>
                </div>
                <span className="plan-count">{plan_distribution.scholar || 0} ({scholarPct}%)</span>
              </div>

              <div className="radial-legend-item">
                <div className="legend-dot-label">
                  <span className="plan-dot dot-free" />
                  <strong>Free Reader (Default)</strong>
                </div>
                <span className="plan-count">{plan_distribution.free || 0} ({freePct}%)</span>
              </div>

              <div className="radial-legend-item">
                <div className="legend-dot-label">
                  <span className="plan-dot dot-institution" />
                  <strong>Institutional Archive</strong>
                </div>
                <span className="plan-count">{plan_distribution.institution || 0} ({institutionPct}%)</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Character Engagement Breakdown Table */}
      <section className="analytics-surface-card character-leaderboard-card">
        <div className="surface-card-header">
          <div>
            <h2 className="surface-card-title">Cognitive Character Engagement</h2>
            <p className="surface-card-sub">
              Comparative dialogue turns, unique reader connections, and live psychological balance.
            </p>
          </div>
          <span className="character-count-tag">
            {character_engagement.length} Active Personas
          </span>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-telemetry-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Literary Work</th>
                <th>Conversations</th>
                <th>Dialogue Volume</th>
                <th>Unique Readers</th>
                <th>Dominant Affect</th>
              </tr>
            </thead>
            <tbody>
              {character_engagement.map((char) => {
                const avatar = getCharacterAvatarUrl(char.name, char.avatar_asset_id);
                const volumePct = Math.round((char.messages_count / maxMessages) * 100);
                const emotions = Object.entries(char.emotion_state || {});
                const dominant = emotions.length ? emotions[0] : ['Balanced', 0.8];

                return (
                  <tr key={char.id}>
                    <td>
                      <div className="persona-cell">
                        <img src={avatar} alt={char.name} className="persona-avatar-img" />
                        <div>
                          <strong>{char.name}</strong>
                          <span className="persona-role-text">{char.role}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="work-tag">{char.book_title}</span>
                    </td>
                    <td className="stat-num">{char.sessions_count}</td>
                    <td>
                      <div className="volume-bar-container">
                        <div className="volume-bar-track">
                          <div
                            className="volume-bar-fill"
                            style={{ width: `${Math.max(volumePct, 8)}%` }}
                          />
                        </div>
                        <span className="volume-text">{char.messages_count} msgs</span>
                      </div>
                    </td>
                    <td className="stat-num">{char.unique_readers}</td>
                    <td>
                      <span className="dominant-affect-badge">
                        ✨ {dominant[0]}: {Math.round((dominant[1] || 0.8) * 100)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
