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
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const moreRef = useRef(null);
  const notifRef = useRef(null);
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

  // Close "More" popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close popovers and flyout drawer on route change
  useEffect(() => {
    setIsNotifOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  const isEffectiveCollapsed = isCollapsed || isNotifOpen;

  // Active path matchers
  const isHomeActive = location.pathname === '/' || location.pathname === '/discover';
  const isBookshelfActive =
    location.pathname.startsWith('/bookshelf') ||
    location.pathname.startsWith('/library') ||
    location.pathname.startsWith('/books');
  const isCharactersActive = location.pathname.startsWith('/characters');
  const isChatsActive =
    location.pathname.startsWith('/chats') ||
    location.pathname.startsWith('/conversations') ||
    location.pathname.startsWith('/chat');
  const isProfileActive =
    location.pathname.startsWith('/profile') || location.pathname.startsWith('/settings');

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
            <span className="lorely-brand-badge-tag">Reader Studio</span>
          </div>
        </div>

        {/* GROUP 2: Main Navigation Items */}
        <nav className="lorely-sidebar-nav">
          {/* 1. Home */}
          <NavLink
            to="/"
            end
            className={`sidebar-nav-item ${isHomeActive ? 'active' : ''}`}
            aria-label="Home"
          >
            <span className="sidebar-item-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isHomeActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className="sidebar-item-label">Home</span>
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

          {/* 4. Chats (replaces Conversations) */}
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

          {/* 5. Notifications */}
          <button
            type="button"
            className={`sidebar-nav-item sidebar-nav-btn ${isNotifOpen ? 'active' : ''}`}
            onClick={() => setIsNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <span className="sidebar-item-icon notif-icon-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isNotifOpen ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              {unreadCount > 0 && <span className="sidebar-notif-dot" />}
            </span>
            <span className="sidebar-item-label">Notifications</span>
          </button>

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

          {/* 7. Profile */}
          <NavLink
            to="/profile"
            className={`sidebar-nav-item ${isProfileActive ? 'active' : ''}`}
            aria-label="Profile"
          >
            <span className="sidebar-item-icon profile-icon-wrap">
              <img
                src={userAvatar}
                alt={displayName}
                className="sidebar-profile-avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/avatars/user_avatar.svg';
                }}
              />
            </span>
            <span className="sidebar-item-label">Profile</span>
          </NavLink>
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

      {/* Instagram-Style Sliding Notifications Flyout Drawer */}
      <NotificationsDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        accessToken={accessToken}
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />

      {/* Main Reader Surface (Top nav bar removed completely) */}
      <div className="lorely-main-container">
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
