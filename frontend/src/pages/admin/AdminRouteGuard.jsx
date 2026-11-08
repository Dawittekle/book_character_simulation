import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function AdminRouteGuard({ userRole, loading, onPromoteToAdmin }) {
  if (loading) {
    return (
      <div className="admin-loading-screen" style={{ padding: '60px', textAlign: 'center', color: '#8CA898' }}>
        <p>Verifying administrative privileges...</p>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div
        className="admin-access-gate"
        style={{
          maxWidth: '540px',
          margin: '60px auto',
          padding: '36px',
          background: '#14241B',
          border: '1px solid #233B2E',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#FAF7F2',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛡️</div>
        <h2 style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: '22px', margin: '0 0 10px', color: '#FAF7F2' }}>
          Administrator Console
        </h2>
        <p style={{ fontSize: '13px', color: '#8CA898', lineHeight: 1.6, margin: '0 0 24px' }}>
          Your current session is operating in reader mode. Activate administrator privileges to curate the shared catalog, oversee document ingestion pipelines, and manage plans.
        </p>
        <button
          type="button"
          onClick={onPromoteToAdmin}
          style={{
            background: '#C89D5C',
            color: '#14241B',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Activate Admin Privileges →
        </button>
      </div>
    );
  }

  return <Outlet />;
}
