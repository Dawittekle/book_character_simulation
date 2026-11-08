import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AddBookModal from './AddBookModal';
import { lorelyApi } from '../services/lorelyApi';
import './AppShell.css';

export default function AppShell({ session, onSignOut, onBookAdded }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const accessToken = session?.access_token;
  const user = session?.user;
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Reader');

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const me = await lorelyApi.getMe(accessToken);
        if (mounted) setProfile(me);
      } catch (err) {
        // Fall back gracefully
      }
    }
    if (accessToken) {
      loadProfile();
    }
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="lorely-app-layout" data-testid="app-shell">
      {/* Left Persistent Dark-Green Sidebar */}
      <aside className="lorely-sidebar">
        <div className="lorely-sidebar-brand" onClick={() => navigate('/')} role="button" tabIndex={0}>
          <div className="lorely-logo-badge">
            <span className="logo-sparkle">✦</span>
            <span className="logo-book-icon">📖</span>
          </div>
          <span className="lorely-brand-title">Lorely</span>
        </div>

        <nav className="lorely-sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">🏛</span>
            <span className="sidebar-item-label">Home</span>
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">📚</span>
            <span className="sidebar-item-label">My Library</span>
          </NavLink>

          <NavLink
            to="/characters"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">👥</span>
            <span className="sidebar-item-label">Characters</span>
          </NavLink>

          <NavLink
            to="/conversations"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">💬</span>
            <span className="sidebar-item-label">Conversations</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">⚙️</span>
            <span className="sidebar-item-label">Settings</span>
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-nav-item admin-portal-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-item-icon">🛡️</span>
              <span className="sidebar-item-label">Admin Console</span>
            </NavLink>
          )}
        </nav>

        <div className="lorely-sidebar-footer">
          {/* Pro Access Badge */}
          <div className="premium-plan-card">
            <div className="premium-plan-icon">👑</div>
            <div className="premium-plan-info">
              <span className="premium-plan-title">Premium Plan</span>
              <span className="premium-plan-sub">✦ Pro Access</span>
            </div>
          </div>

          {/* User Profile Row */}
          <div className="sidebar-user-row" ref={dropdownRef}>
            <button
              type="button"
              className="sidebar-user-button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-label="User account menu"
            >
              <img
                src="/avatars/user_avatar.svg"
                alt={displayName}
                className="sidebar-user-avatar"
              />
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-caret">▾</span>
            </button>

            {isDropdownOpen && (
              <div className="sidebar-user-dropdown">
                <div className="dropdown-user-header">
                  <span className="dropdown-user-name">{displayName}</span>
                  <span className="dropdown-user-email">{user?.email}</span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/admin');
                    }}
                  >
                    🛡️ Admin Console
                  </button>
                )}
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/settings');
                  }}
                >
                  ⚙️ Preferences
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item dropdown-item-danger"
                  onClick={onSignOut}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lorely-main-container">
        {/* Top Header with Search and Notifications */}
        <header className="lorely-top-header">
          <form className="lorely-search-form" onSubmit={handleSearchSubmit}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="lorely-search-input"
              placeholder="Search books, characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="top-header-right">
            <button type="button" className="notification-bell-btn" aria-label="Notifications">
              🔔
            </button>
            <img
              src="/avatars/user_avatar.svg"
              alt={displayName}
              className="header-avatar"
              onClick={() => navigate('/settings')}
            />
          </div>
        </header>

        {/* Child Page Outlet */}
        <main className="lorely-page-outlet">
          <Outlet context={{ openAddBookModal: () => setIsAddBookOpen(true), accessToken }} />
        </main>
      </div>

      {/* Ingestion & Document Inspection Modal */}
      <AddBookModal
        isOpen={isAddBookOpen}
        onClose={() => setIsAddBookOpen(false)}
        onBookAdded={(book) => {
          if (onBookAdded) onBookAdded(book);
          navigate(`/books/${book.id}`);
        }}
        accessToken={accessToken}
      />
    </div>
  );
}
