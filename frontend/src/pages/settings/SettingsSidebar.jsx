import React, { useRef } from 'react';
import {
  User,
  ShieldCheck,
  Palette,
  BookOpen,
  Languages,
  Bell,
  CreditCard,
  Database,
  ChevronRight,
} from 'lucide-react';

export const SETTINGS_SECTIONS = [
  {
    category: 'ACCOUNT',
    items: [
      {
        id: 'profile',
        title: 'Profile',
        subtitle: 'Name, email, profile picture and avatar',
        icon: User,
      },
      {
        id: 'security',
        title: 'Security & Sign-in',
        subtitle: 'Password, Google account and active sessions',
        icon: ShieldCheck,
      },
    ],
  },
  {
    category: 'PREFERENCES',
    items: [
      {
        id: 'appearance',
        title: 'Appearance',
        subtitle: 'App themes, colors and accessibility',
        icon: Palette,
      },
      {
        id: 'reading-audio',
        title: 'Reading & Audio',
        subtitle: 'Reading layout, narration and voice',
        icon: BookOpen,
      },
      {
        id: 'language',
        title: 'Language & Region',
        subtitle: 'English, Amharic and regional preferences',
        icon: Languages,
      },
      {
        id: 'notifications',
        title: 'Notifications',
        subtitle: 'Email and in-app notifications',
        icon: Bell,
      },
    ],
  },
  {
    category: 'PLAN',
    items: [
      {
        id: 'billing',
        title: 'Subscription & Billing',
        subtitle: 'Plan, usage, payment and invoices',
        icon: CreditCard,
      },
    ],
  },
  {
    category: 'PRIVACY',
    items: [
      {
        id: 'privacy',
        title: 'Privacy & Data',
        subtitle: 'Your data, exports and account deletion',
        icon: Database,
      },
    ],
  },
];

export default function SettingsSidebar({ activeTab, onSelectTab, isMobile = false }) {
  const containerRef = useRef(null);

  // Flattened list of item IDs for keyboard arrow navigation
  const allItemIds = SETTINGS_SECTIONS.flatMap((g) => g.items.map((i) => i.id));

  const handleKeyDown = (e, currentId) => {
    const currentIndex = allItemIds.indexOf(currentId);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % allItemIds.length;
      onSelectTab(allItemIds[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + allItemIds.length) % allItemIds.length;
      onSelectTab(allItemIds[prevIndex]);
    }
  };

  return (
    <nav
      ref={containerRef}
      className="settings-sidebar"
      aria-label="Settings navigation"
      role="tablist"
      aria-orientation="vertical"
    >
      {SETTINGS_SECTIONS.map((group) => (
        <div key={group.category} className="settings-sidebar-group">
          <div className="settings-group-header">{group.category}</div>
          <div className="settings-group-items">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-controls={`panel-${item.id}`}
                  aria-selected={isActive}
                  className={`settings-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectTab(item.id)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                >
                  <div className="settings-nav-item-icon-wrap">
                    <Icon className="settings-nav-item-icon" size={17} aria-hidden="true" />
                  </div>
                  <div className="settings-nav-item-content">
                    <span className="settings-nav-item-title">{item.title}</span>
                    <span className="settings-nav-item-subtitle">{item.subtitle}</span>
                  </div>
                  <ChevronRight
                    className={`settings-nav-item-chevron ${isMobile ? 'mobile-visible' : ''}`}
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
