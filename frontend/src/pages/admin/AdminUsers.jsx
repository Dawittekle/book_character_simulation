import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminUsers.css';

export default function AdminUsers() {
  const { accessToken } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        const list = await lorelyApi.adminListUsers(accessToken);
        if (mounted) setUsers(list);
      } catch (err) {
        // Fall back gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUsers();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleToggleRole = async (user) => {
    if (user.email === 'admin@lorely.app') return;
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    setUpdatingId(user.id);

    try {
      const updated = await lorelyApi.adminUpdateUserRole(user.id, nextRole, accessToken);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u)),
      );
    } catch (err) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.email === 'admin@lorely.app') return;
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.email || user.display_name}?`)) {
      return;
    }
    setUpdatingId(user.id);
    try {
      await lorelyApi.adminDeleteUser(user.id, accessToken);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="admin-users-view" data-testid="admin-users">
      <header className="users-header-line">
        <div>
          <h1 className="users-title">User Roles & Access Control</h1>
          <p className="users-sub">
            Authoritative platform access control. Primary admin (admin@lorely.app) is protected and cannot be deleted or demoted.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="admin-subtext">Loading user accounts...</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-telemetry-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Display Name</th>
                <th>Email</th>
                <th>Plan Tier</th>
                <th>Books Owned</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isPrimaryAdmin = u.email === 'admin@lorely.app';
                return (
                  <tr key={u.id}>
                    <td className="code-font">{u.id.slice(0, 8)}...</td>
                    <td>
                      <strong>{u.display_name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="type-badge">
                        {u.plan_tier || 'scholar'}
                      </span>
                    </td>
                    <td>{u.book_count}</td>
                    <td>
                      <span className={`role-pill pill-${u.role}`}>
                        {isPrimaryAdmin ? '🛡️ Primary Admin' : u.role === 'admin' ? '🛡️ Admin' : '📖 Reader'}
                      </span>
                    </td>
                    <td>
                      {isPrimaryAdmin ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: '#C89D5C',
                            fontWeight: 600,
                            padding: '4px 8px',
                            background: 'rgba(200, 157, 92, 0.1)',
                            borderRadius: '4px',
                            border: '1px solid rgba(200, 157, 92, 0.25)',
                          }}
                        >
                          🔒 Protected Admin
                        </span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className={`role-toggle-btn ${u.role === 'admin' ? 'demote' : 'promote'}`}
                            disabled={updatingId === u.id}
                            onClick={() => handleToggleRole(u)}
                          >
                            {u.role === 'admin' ? 'Demote to Reader' : 'Promote to Admin'}
                          </button>
                          <button
                            type="button"
                            className="role-toggle-btn demote"
                            style={{ background: '#451a1a', borderColor: '#7a2828' }}
                            disabled={updatingId === u.id}
                            onClick={() => handleDeleteUser(u)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
