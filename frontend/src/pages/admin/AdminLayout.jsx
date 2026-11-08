import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

export default function AdminLayout({ accessToken }) {
  const navigate = useNavigate();

  return (
    <div className="lorely-admin-layout" data-testid="admin-layout">
      <header className="admin-console-header">
        <div className="admin-brand-group">
          <div className="admin-badge">
            <span className="admin-badge-icon">🛡️</span>
            <span className="admin-badge-text">Operations Console</span>
          </div>
          <span className="admin-header-sep">/</span>
          <span className="admin-header-title">Lorely Administration</span>
        </div>

        <nav className="admin-nav-tabs">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Overview
          </NavLink>
          <NavLink
            to="/admin/catalog"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Catalog & Featured
          </NavLink>
          <NavLink
            to="/admin/jobs"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Processing Jobs
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            User Roles
          </NavLink>
        </nav>

        <div className="admin-header-right">
          <button
            type="button"
            className="admin-return-btn"
            onClick={() => navigate('/')}
          >
            ← Back to Reading
          </button>
        </div>
      </header>

      <main className="admin-main-container">
        <Outlet context={{ accessToken }} />
      </main>
    </div>
  );
}
