import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';

export default function AdminRouteGuard({ userRole, loading }) {
  if (loading) {
    return (
      <div className="admin-loading-screen" style={{ padding: '60px', textAlign: 'center', color: '#8CA898' }}>
        <p>Verifying administrative privileges...</p>
      </div>
    );
  }

  const adminToken = lorelyApi.getStoredAdminToken();
  const isAuthorizedAdmin = Boolean(adminToken || userRole === 'admin');

  if (!isAuthorizedAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
