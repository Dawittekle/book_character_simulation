import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import AddBookModal from './AddBookModal';
import NotificationsDrawer from './NotificationsDrawer';
import PricingModal from './PricingModal';
import MoreMenuPopover from './MoreMenuPopover';
import ReportProblemModal from './ReportProblemModal';
import { BrandLogo } from './brand';
import { lorelyApi, resolveAvatarUrl } from '../services/lorelyApi';
import './AppShell.css';

export default function AppShell({ session, onSignOut, onBookAdded }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const moreRef = useRef(null);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const accessToken = session?.access_token;
  const user = session?.user;
  const displayName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Reader');
  const userAvatar =
    resolveAvatarUrl(profile?.avatar_url) ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    '/avatars/user_avatar.svg';

  const handleProfileUpdated = (updatedProfile) => {
    if (!updatedProfile) return;
    setProfile((prev) => ({
      ...prev,
      ...updatedProfile,
      avatar_url: resolveAvatarUrl(updatedProfile.avatar_url ?? prev?.avatar_url),
    }));
  };

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

  useEffect(() => {
    function handleCustomProfileUpdate(event) {
      if (event?.detail) {
        handleProfileUpdated(event.detail);
      }
    }
    window.addEventListener('lorely:profile-updated', handleCustomProfileUpdate);
    return () => {
      window.removeEventListener('lorely:profile-updated', handleCustomProfileUpdate);
    };
  }, []);

  const isAdmin = profile?.role === 'admin';

  // Close "More" popover and Profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close popovers and flyout drawer on route change
  useEffect(() => {
    setIsNotifOpen(false);
    setIsMoreOpen(false);
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  const isEffectiveCollapsed = isCollapsed;

  // Active path matchers
  const isDiscoverActive =
    location.pathname === '/' ||
    location.pathname === '/discover' ||
    location.pathname.startsWith('/discover');
  const isBookshelfActive =
    location.pathname.startsWith('/bookshelf') ||
    location.pathname.startsWith('/library') ||
    location.pathname.startsWith('/books');
  const isCharactersActive = location.pathname.startsWith('/characters');
  const isChatsActive =
    location.pathname.startsWith('/chats') ||
    location.pathname.startsWith('/conversations') ||
    location.pathname.startsWith('/chat');

  return (
    <div className={`lorely-app-layout ${isEffectiveCollapsed ? 'is-sidebar-collapsed' : ''} ${isNotifOpen ? 'is-notifications-open' : ''}`} data-testid="app-shell">
      {/* Instagram-style 3-group vertical navigation sidebar */}
      <aside className={`lorely-sidebar ${isEffectiveCollapsed ? 'collapsed' : ''}`}>
        {/* GROUP 1: Brand Header */}
        <div
          className="lorely-sidebar-brand"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          aria-label="Lorely Home"
        >
          <div className="lorely-logo-badge">
            <BrandLogo size={28} variant="orange" withText={false} />
          </div>
          <div className="lorely-brand-group">
            <span className="lorely-brand-title">Lorely</span>
          </div>
        </div>

        {/* GROUP 2: Main Navigation Items (Discover, Bookshelf, Book Store, Characters, Chats, Add book) */}
        <nav className="lorely-sidebar-nav">
          {/* 1. Discover (Renamed from Home) */}
          <NavLink
            to="/"
            end
            className={`sidebar-nav-item ${isDiscoverActive ? 'active' : ''}`}
            aria-label="Discover"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={isDiscoverActive ? 'currentColor' : 'none'} />
              </svg>
            </span>
            <span className="sidebar-item-label">Discover</span>
          </NavLink>

          {/* 2. Bookshelf (replaces My Library) */}
          <NavLink
            to="/bookshelf"
            className={`sidebar-nav-item ${isBookshelfActive ? 'active' : ''}`}
            aria-label="Bookshelf"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </span>
            <span className="sidebar-item-label">Bookshelf</span>
          </NavLink>

          {/* 3. Characters */}
          <NavLink
            to="/characters"
            className={`sidebar-nav-item ${isCharactersActive ? 'active' : ''}`}
            aria-label="Characters"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="sidebar-item-label">Characters</span>
          </NavLink>

          {/* 5. Chats (replaces Conversations) */}
          <NavLink
            to="/chats"
            className={`sidebar-nav-item ${isChatsActive ? 'active' : ''}`}
            aria-label="Chats"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </span>
            <span className="sidebar-item-label">Chats</span>
          </NavLink>

          {/* 6. Add book (Upload modal trigger) */}
          <button
            type="button"
            className="sidebar-nav-item sidebar-nav-btn"
            onClick={() => setIsAddBookOpen(true)}
            aria-label="Add book"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </span>
            <span className="sidebar-item-label">Add book</span>
          </button>
        </nav>

        {/* GROUP 3: Bottom Utility Group — More Button Only */}
        <div className="lorely-sidebar-footer" ref={moreRef}>
          <button
            type="button"
            className={`sidebar-nav-item sidebar-nav-btn sidebar-more-btn ${isMoreOpen ? 'active' : ''}`}
            onClick={() => setIsMoreOpen((prev) => !prev)}
            aria-label="More"
            aria-expanded={isMoreOpen}
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </span>
            <span className="sidebar-item-label">More</span>
          </button>

          {/* Floating Instagram-Style "More" Popover Menu */}
          <MoreMenuPopover
            isOpen={isMoreOpen}
            onClose={() => setIsMoreOpen(false)}
            onSignOut={onSignOut}
            isAdmin={isAdmin}
            onOpenReport={() => setIsReportOpen(true)}
          />
        </div>
      </aside>

      {/* Sliding Notifications Flyout Drawer */}
      <NotificationsDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        accessToken={accessToken}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />

      {/* Main Reader Surface with Top-Right Floating Controls */}
      <div className="lorely-main-container">
        {/* Canvas Top Header (Desktop Floating Utility / Mobile Sticky App Bar) */}
        <header className="lorely-canvas-header" data-testid="app-shell-topbar">
          <div
            className="canvas-header-mobile-brand"
            onClick={() => navigate('/discover')}
            role="button"
            tabIndex={0}
            aria-label="Lorely Discover"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/discover');
              }
            }}
          >
            <BrandLogo variant="minimal" size={26} />
          </div>

          <div className="canvas-header-right">
            {/* Notification Bell Button */}
            <button
              type="button"
              className={`canvas-header-btn canvas-notif-btn ${isNotifOpen ? 'active' : ''}`}
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label="Notifications"
              aria-expanded={isNotifOpen}
            >
              <span className="canvas-header-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isNotifOpen ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="canvas-notif-badge" aria-label={`${unreadCount} unread notifications`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
            </button>

            {/* Profile Pill with Dropdown */}
            <div className="canvas-profile-container" ref={profileMenuRef}>
              <button
                type="button"
                className={`canvas-profile-pill ${isProfileMenuOpen ? 'active' : ''}`}
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-label="Profile"
                aria-expanded={isProfileMenuOpen}
              >
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="canvas-profile-avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/avatars/user_avatar.svg';
                  }}
                />
                <span className="canvas-profile-name">{displayName}</span>
                <svg
                  className={`canvas-profile-chevron ${isProfileMenuOpen ? 'rotated' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="canvas-profile-dropdown" role="menu" aria-label="Profile options">
                  <div className="canvas-dropdown-header">
                    <span className="canvas-dropdown-name">{displayName}</span>
                    <span className="canvas-dropdown-email">{user?.email}</span>
                  </div>
                  <div className="canvas-dropdown-divider" />
                  <button
                    type="button"
                    className="canvas-dropdown-item"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/profile');
                    }}
                    role="menuitem"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Profile</span>
                  </button>
                  <button
                    type="button"
                    className="canvas-dropdown-item"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                    role="menuitem"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  <div className="canvas-dropdown-divider" />
                  <button
                    type="button"
                    className="canvas-dropdown-item text-danger"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      if (onSignOut) onSignOut();
                    }}
                    role="menuitem"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="lorely-page-outlet">
          <Outlet
            context={{
              openAddBookModal: () => setIsAddBookOpen(true),
              openPricingModal: () => setIsPricingModalOpen(true),
              accessToken,
              session,
              profile,
              userAvatar,
              onProfileUpdated: handleProfileUpdated,
              onSignOut,
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

      {/* Report a Problem Feedback Modal */}
      <ReportProblemModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
}
