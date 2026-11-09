import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import BrandLogo from '../../components/brand/BrandLogo';
import BadgePill from '../../components/brand/BadgePill';
import './AdminLayout.css';

export default function AdminLayout() {
  const navigate = useNavigate();
  const adminToken = lorelyApi.getStoredAdminToken();

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin/login', { replace: true });
    }
  }, [adminToken, navigate]);

  const handleAdminLogout = () => {
    lorelyApi.adminLogout();
    navigate('/admin/login');
  };

  return (
    <div className="lorely-admin-layout" data-testid="admin-layout">
      <header className="admin-console-header">
        <div className="admin-brand-group">
          <BrandLogo size="sm" showTagline={false} showText={false} />
          <div className="admin-badge">
            <span className="admin-badge-dot" />
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
            to="/admin/analytics"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Analytics & Telemetry
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
          <NavLink
            to="/admin/plans"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Plans & Quotas
          </NavLink>
          <NavLink
            to="/admin/subscribers"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Subscribers & Payments
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) => `admin-nav-tab ${isActive ? 'active' : ''}`}
          >
            Settings
          </NavLink>
        </nav>

        <div className="admin-header-right">
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleAdminLogout}
          >
            Sign Out Admin
          </button>
        </div>
      </header>

      <main className="admin-main-container">
        <Outlet context={{ accessToken: adminToken }} />
      </main>
    </div>
  );
}
