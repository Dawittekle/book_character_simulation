import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';

export default function AdminRouteGuard() {
  const adminToken = lorelyApi.getStoredAdminToken();

  if (!adminToken) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
