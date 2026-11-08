import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { lorelyApi } from '../services/lorelyApi';
import { formatRelativeDate } from '../lib/formatters';
import './NotificationsDropdown.css';

export default function NotificationsDropdown({ isOpen, onClose, accessToken, onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'broadcast' | 'ingestion'
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
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
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [accessToken, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
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
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
    }
    onClose();
    if (n.link_url) {
      navigate(n.link_url);
    }
  };

  if (!isOpen) return null;

  const listItems = Array.isArray(notifications) ? notifications : [];
  const filtered = listItems.filter((n) => {
    if (filter === 'broadcast') return n.category === 'admin_broadcast';
    if (filter === 'ingestion') return n.category === 'ingestion';
    return true;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'admin_broadcast':
        return '📣';
      case 'ingestion':
        return '📚';
      case 'character':
        return '🎭';
      default:
        return '✦';
    }
  };

  return (
    <div
      className="notifications-dropdown-menu"
      ref={dropdownRef}
      role="dialog"
      aria-label="Notification Center"
      data-testid="notifications-dropdown"
    >
      <header className="notif-dropdown-header">
        <div className="notif-header-title">
          <h3>Notifications</h3>
          <span className="notif-badge-pill">
            {listItems.filter((n) => !n.is_read).length} new
          </span>
        </div>
        <button
          type="button"
          className="notif-mark-all-btn"
          onClick={handleMarkAllRead}
        >
          Mark all as read
        </button>
      </header>

      {/* Filter Tabs */}
      <div className="notif-tabs-row">
        <button
          type="button"
          className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({listItems.length})
        </button>
        <button
          type="button"
          className={`notif-tab ${filter === 'broadcast' ? 'active' : ''}`}
          onClick={() => setFilter('broadcast')}
        >
          Announcements
        </button>
        <button
          type="button"
          className={`notif-tab ${filter === 'ingestion' ? 'active' : ''}`}
          onClick={() => setFilter('ingestion')}
        >
          Processing
        </button>
      </div>

      {/* Notification Stream */}
      <div className="notif-items-list">
        {loading && notifications.length === 0 ? (
          <p className="notif-empty-state">Loading notifications...</p>
        ) : filtered.length === 0 ? (
          <div className="notif-empty-state">
            <span>✨</span>
            <p>You’re all caught up! No recent notifications.</p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`notif-item-row ${!n.is_read ? 'unread' : 'read'}`}
              onClick={() => handleNotificationClick(n)}
              role="article"
              tabIndex={0}
            >
              <span className="notif-cat-icon">{getCategoryIcon(n.category)}</span>
              <div className="notif-content-col">
                <div className="notif-title-row">
                  <h4 className="notif-item-title">{n.title}</h4>
                  {!n.is_read && <span className="unread-dot" />}
                </div>
                <p className="notif-item-desc">{n.message}</p>
                <div className="notif-meta-row">
                  <span className="notif-timestamp">{formatRelativeDate(n.created_at)}</span>
                  {!n.is_read && (
                    <button
                      type="button"
                      className="notif-read-btn"
                      onClick={(e) => handleMarkRead(e, n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
