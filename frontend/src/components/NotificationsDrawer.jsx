import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { formatRelativeDate } from '../lib/formatters';
import './NotificationsDrawer.css';

/**
 * NotificationsDrawer Component
 * Instagram-Style sliding flyout drawer anchored next to the collapsed 72px icon rail.
 * Width: 397px, full viewport height.
 * Features:
 * - Grouped by recency ("New", "Today", "This week", "Earlier")
 * - Category filters (All, Announcements, Processing)
 * - Electric Blue (#2589FF) unread indicators & badge pills
 * - Single-click "Mark read" and global "Mark all as read"
 * - Keyboard Escape and backdrop outside-click dismissal
 */
export default function NotificationsDrawer({
  isOpen,
  onClose,
  accessToken,
  onUnreadCountChange,
}) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'broadcast' | 'ingestion'
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await lorelyApi.listNotifications(accessToken);
      const list = Array.isArray(res) ? res : [];
      setNotifications(list);
      const unreadCount = list.filter((n) => !n.is_read).length;
      if (onUnreadCountChange) onUnreadCountChange(unreadCount);
    } catch (err) {
      // Fallback gracefully on network / auth error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [accessToken, isOpen]);

  // Handle Escape key to close drawer
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside drawer container
  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        // Only trigger if click was not on the sidebar notif toggle button
        const isNotifTrigger = event.target.closest?.('.notif-icon-wrap') || event.target.closest?.('[aria-label="Notifications"]');
        if (!isNotifTrigger) {
          onClose();
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    try {
      await lorelyApi.markNotificationRead(id, accessToken);
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        const unreadCount = next.filter((n) => !n.is_read).length;
        if (onUnreadCountChange) onUnreadCountChange(unreadCount);
        return next;
      });
    } catch (err) {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await lorelyApi.markAllNotificationsRead(accessToken);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      // Ignore
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) {
      lorelyApi.markNotificationRead(n.id, accessToken).catch(() => {});
      setNotifications((prev) => {
        const next = prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item));
        const unreadCount = next.filter((item) => !item.is_read).length;
        if (onUnreadCountChange) onUnreadCountChange(unreadCount);
        return next;
      });
    }
    onClose();
    if (n.link_url) {
      navigate(n.link_url);
    }
  };

  if (!isOpen) return null;

  const listItems = Array.isArray(notifications) ? notifications : [];
  const unreadTotal = listItems.filter((n) => !n.is_read).length;

  const filtered = listItems.filter((n) => {
    if (filter === 'broadcast') return n.category === 'admin_broadcast';
    if (filter === 'ingestion') return n.category === 'ingestion';
    return true;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'admin_broadcast':
        return (
          <span className="notif-category-icon broadcast-icon" aria-label="Announcement">
            📣
          </span>
        );
      case 'ingestion':
        return (
          <span className="notif-category-icon ingestion-icon" aria-label="Ingestion">
            📚
          </span>
        );
      case 'character':
        return (
          <span className="notif-category-icon character-icon" aria-label="Character">
            🎭
          </span>
        );
      default:
        return (
          <span className="notif-category-icon default-icon" aria-label="Notification">
            ✦
          </span>
        );
    }
  };

  // Group notifications by Instagram-style recency
  const groupNotifications = (items) => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;

    const newItems = [];
    const today = [];
    const thisWeek = [];
    const earlier = [];

    items.forEach((item) => {
      if (!item.is_read) {
        newItems.push(item);
        return;
      }
      const itemTime = item.created_at ? new Date(item.created_at).getTime() : now;
      const diff = Math.max(0, now - itemTime);

      if (diff < ONE_DAY) {
        today.push(item);
      } else if (diff < ONE_WEEK) {
        thisWeek.push(item);
      } else {
        earlier.push(item);
      }
    });

    const sections = [];
    if (newItems.length > 0) sections.push({ title: 'New', items: newItems });
    if (today.length > 0) sections.push({ title: 'Today', items: today });
    if (thisWeek.length > 0) sections.push({ title: 'This week', items: thisWeek });
    if (earlier.length > 0) sections.push({ title: 'Earlier', items: earlier });

    if (sections.length === 0 && items.length > 0) {
      sections.push({ title: 'Notifications', items });
    }

    return sections;
  };

  const sections = groupNotifications(filtered);

  return (
    <>
      {/* Backdrop for outside click */}
      <div
        className="notifications-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
        data-testid="notifications-backdrop"
      />

      {/* Instagram 397px Flyout Drawer */}
      <div
        className="notifications-drawer"
        ref={drawerRef}
        role="dialog"
        aria-label="Notification Center"
        data-testid="notifications-dropdown"
      >
        {/* Header */}
        <header className="notif-drawer-header">
          <div className="notif-header-title">
            <h3 className="notif-title-heading">Notifications</h3>
            <span className="notif-badge-pill" data-testid="notif-badge">
              {unreadTotal} new
            </span>
          </div>

          <div className="notif-header-actions">
            {unreadTotal > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
            <button
              type="button"
              className="notif-close-btn"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="notif-tabs-row" role="tablist" aria-label="Notification filters">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({listItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'broadcast'}
            className={`notif-tab ${filter === 'broadcast' ? 'active' : ''}`}
            onClick={() => setFilter('broadcast')}
          >
            Announcements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'ingestion'}
            className={`notif-tab ${filter === 'ingestion' ? 'active' : ''}`}
            onClick={() => setFilter('ingestion')}
          >
            Processing
          </button>
        </div>

        {/* Grouped Notification Stream */}
        <div className="notif-list-container" tabIndex={0} aria-label="Notifications stream">
          {loading && notifications.length === 0 ? (
            <div className="notif-empty-state">
              <p className="notif-empty-text">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="notif-empty-state">
              <span className="notif-empty-icon">✨</span>
              <p className="notif-empty-text">You’re all caught up!</p>
              <span className="notif-empty-sub">No recent notifications.</span>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="notif-section-group">
                <div className="notif-section-header">
                  <span className="notif-section-title">{section.title}</span>
                </div>
                <div className="notif-section-items">
                  {section.items.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.is_read ? 'is-unread' : 'is-read'}`}
                      onClick={() => handleNotificationClick(n)}
                      role="article"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(n);
                        }
                      }}
                    >
                      <div className="notif-item-icon-box">{getCategoryIcon(n.category)}</div>
                      <div className="notif-item-content">
                        <div className="notif-item-title-row">
                          <h4 className="notif-item-title">{n.title}</h4>
                          {!n.is_read && <span className="notif-unread-dot" aria-label="Unread" />}
                        </div>
                        <p className="notif-item-message">{n.message}</p>
                        <div className="notif-item-footer">
                          <span className="notif-item-time">{formatRelativeDate(n.created_at)}</span>
                          {!n.is_read && (
                            <button
                              type="button"
                              className="notif-item-read-action"
                              onClick={(e) => handleMarkRead(e, n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
