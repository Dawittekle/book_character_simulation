import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function AdminRouteGuard({ userRole, loading }) {
  if (loading) {
    return (
      <div className="admin-loading-screen" style={{ padding: '60px', textAlign: 'center' }}>
        <p>Verifying administrative privileges...</p>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}
