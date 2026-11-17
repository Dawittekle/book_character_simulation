import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyAppTheme } from '../lib/themeManager';
import './MoreMenuPopover.css';

/**
 * MoreMenuPopover Component
 *
 * Instagram-style floating card menu anchored directly above the sidebar's "More" button.
 * Includes Settings, Your activity, Saved, Switch appearance (Dark/Light toggle),
 * Report a problem, Admin/Switch accounts, and Log out.
 */
export default function MoreMenuPopover({
  isOpen,
  onClose,
  onSignOut,
  isAdmin = false,
  onOpenReport = null,
}) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setIsDark(currentTheme === 'dark');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAppearance = (e) => {
    e.stopPropagation();
    const nextDark = !isDark;
    setIsDark(nextDark);
    applyAppTheme(nextDark ? 'dark' : 'light');
  };

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="instagram-more-popover"
      role="menu"
      aria-label="More options"
      data-testid="more-menu-popover"
    >
      {/* 1. Settings */}
      <button
        type="button"
        className="more-popover-item"
        onClick={() => handleNavigate('/settings')}
        role="menuitem"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Settings</span>
      </button>

      {/* 2. Your activity */}
      <button
        type="button"
        className="more-popover-item"
        onClick={() => handleNavigate('/settings?tab=reading')}
        role="menuitem"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span>Your activity</span>
      </button>

      {/* 3. Saved */}
      <button
        type="button"
        className="more-popover-item"
        onClick={() => handleNavigate('/bookshelf?filter=favorites')}
        role="menuitem"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
        <span>Saved</span>
      </button>

      {/* 4. Switch appearance (Live Dark / Light Theme Toggle) */}
      <button
        type="button"
        className="more-popover-item appearance-item"
        onClick={handleToggleAppearance}
        role="menuitem"
        aria-label={`Switch appearance: currently ${isDark ? 'Dark' : 'Light'}`}
      >
        <div className="more-item-left">
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
          <span>Switch appearance</span>
        </div>
        <div className={`appearance-toggle-track ${isDark ? 'is-dark' : ''}`}>
          <div className="appearance-toggle-thumb" />
        </div>
      </button>

      {/* 5. Report a problem */}
      <button
        type="button"
        className="more-popover-item"
        onClick={() => {
          onClose();
          if (onOpenReport) onOpenReport();
        }}
        role="menuitem"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Report a problem</span>
      </button>

      <div className="more-popover-divider" />

      {/* 6. Admin Console (conditional) */}
      {isAdmin && (
        <button
          type="button"
          className="more-popover-item"
          onClick={() => handleNavigate('/admin')}
          role="menuitem"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span>Admin Console</span>
        </button>
      )}

      {/* 7. Switch accounts */}
      <button
        type="button"
        className="more-popover-item"
        onClick={() => handleNavigate('/login')}
        role="menuitem"
      >
        <span>Switch accounts</span>
      </button>

      <div className="more-popover-divider" />

      {/* 8. Log out */}
      <button
        type="button"
        className="more-popover-item more-popover-danger"
        onClick={() => {
          onClose();
          onSignOut();
        }}
        role="menuitem"
      >
        <span>Log out</span>
      </button>
    </div>
  );
}
