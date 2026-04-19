import React from 'react';
import '../../components/AppShell.css';

export default function UserManagement() {
  const dummyUsers = [
    { id: 1, name: 'Dawit Teklebrhan', email: 'teklebrahandawit309@gmail.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Sarah Jane', email: 'sarah.j@example.com', role: 'Manager', status: 'Active' },
    { id: 3, name: 'Mark Simmons', email: 'mark.s@example.com', role: 'User', status: 'Pending' },
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-breadcrumbs">
          <span>Dawit Teklebrhan Team</span>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1>User Management</h1>
        <p>Control platform access, manage user permissions, and audit simulation usage globally.</p>
      </section>

      <section className="dashboard-grid-section">
        <div className="dashboard-section-header">
          <span>ACTIVE DIRECTORY ({dummyUsers.length})</span>
          <div className="dashboard-section-actions">
            <button className="primary-button" style={{ padding: '0.4rem 1rem', minHeight: 'auto', fontSize: '0.85rem' }}>+ Invite User</button>
          </div>
        </div>

        <div className="surface-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8F6F4', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Name</th>
                <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</th>
                <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role</th>
                <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dummyUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '1rem' }}><strong>{user.name}</strong></td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '1rem' }}><span className="outline-pill" style={{ margin: 0 }}>{user.role}</span></td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ color: user.status === 'Active' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                      {user.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button className="ghost-button" style={{ padding: '0.2rem 0.5rem', minHeight: 0 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
