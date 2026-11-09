import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import AddBookModal from './AddBookModal';
import NotificationsDropdown from './NotificationsDropdown';
import PricingModal from './PricingModal';
import { BrandLogo } from './brand';
import { lorelyApi } from '../services/lorelyApi';
import './AppShell.css';

export default function AppShell({ session, onSignOut, onBookAdded }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
      {/* Modern Light Sidebar with Editorial Brand Identity */}
      <aside className="lorely-sidebar">
        {/* Brand Logo & Studio Header */}
        <div
          className="lorely-sidebar-brand"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
        >
          <div className="lorely-logo-badge">
            <BrandLogo size={28} variant="orange" />
          </div>
          <div className="lorely-brand-group">
            <span className="lorely-brand-title">Lorely</span>
            <span className="lorely-brand-badge-tag">Reader Studio</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="lorely-sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className="sidebar-item-label">Home</span>
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </span>
            <span className="sidebar-item-label">My Library</span>
          </NavLink>

          <NavLink
            to="/characters"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="sidebar-item-label">Characters</span>
          </NavLink>

          <NavLink
            to="/conversations"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span className="sidebar-item-label">Conversations</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span className="sidebar-item-label">Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Active Subscription Pill & User Profile */}
        <div className="lorely-sidebar-footer">
          {/* Active Subscription Pill Card (Matches Image 4) */}
          <button
            type="button"
            className="premium-plan-card"
            onClick={() => setIsPricingModalOpen(true)}
            aria-label="View pricing plans"
          >
            <div className="premium-plan-icon-wrap">
              <span className="premium-plan-crown">👑</span>
            </div>
            <div className="premium-plan-info">
              <span className="premium-plan-title">Premium Plan</span>
              <span className="premium-plan-sub">✦ Pro Access</span>
            </div>
          </button>

          {/* User Profile Pill Row */}
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
                  <span className="dropdown-user-email">{user?.email || 'reader@lorely.app'}</span>
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

      {/* Main Reader Application Surface */}
      <div className="lorely-main-container">
        {/* Top Header with Search, Notifications, and Profile */}
        <header className="lorely-top-header">
          <form className="lorely-search-form" onSubmit={handleSearchSubmit}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="search-icon-svg"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="lorely-search-input"
              placeholder="Search books, characters, or themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="top-header-right">
            <button
              type="button"
              className="notification-bell-btn"
              aria-label="Notifications"
              onClick={() => setIsNotifOpen((prev) => !prev)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unreadCount > 0 && <span className="notification-unread-badge">{unreadCount}</span>}
            </button>

            <NotificationsDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              accessToken={accessToken}
              onUnreadCountChange={(count) => setUnreadCount(count)}
            />

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
          <Outlet
            context={{
              openAddBookModal: () => setIsAddBookOpen(true),
              openPricingModal: () => setIsPricingModalOpen(true),
              accessToken,
            }}
          />
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

      {/* Membership & Pricing Plans Modal */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        accessToken={accessToken}
        userPlan={profile?.preferences?.plan_tier || profile?.plan_tier || 'free'}
        userEmail={user?.email}
      />
    </div>
  );
}
