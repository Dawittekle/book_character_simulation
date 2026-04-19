import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import './AppShell.css';
import {
  formatRelativeDate,
  getInitials,
} from '../lib/formatters';

function AppShell({ session, workspace, workspaceSearch, onSearchChange, onSignOut }) {
  const location = useLocation();
  const activeTextId =
    matchPath('/workspace/:textId', location.pathname)?.params.textId ||
    matchPath('/chat/:textId/:characterId', location.pathname)?.params.textId ||
    null;

  const books = workspace.books || [];
  const latestBook = books[0] || null;
  const currentBook =
    books.find((book) => book.textId === activeTextId) || latestBook;

  const navigationItems = [
    {
      label: 'Home',
      to: '/',
    },
    {
      label: 'Character Board',
      to: currentBook ? `/workspace/${currentBook.textId}` : '/',
    },
    {
      label: 'Conversation',
      to:
        currentBook && currentBook.activeCharacterId
          ? `/chat/${currentBook.textId}/${currentBook.activeCharacterId}`
          : currentBook
            ? `/workspace/${currentBook.textId}`
            : '/',
    },
    {
      label: 'Activity',
      to: '#', // dummy link
    },
    {
      label: 'Templates',
      to: '#', // dummy link
    },
    {
      label: 'Archive',
      to: '#', // dummy link
    },
    {
      label: 'Help docs',
      to: '#', // dummy link
    }
  ];

  const displayName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email ||
    'Reader';

  return (
    <div className="shell-page">
      <div className="shell-banner">
        <span>Experience the magic of Lorely without the chaos</span>
        <button className="shell-banner-link" type="button">See Plans</button>
      </div>

      <div className="shell-layout">
        <aside className="shell-sidebar">
          <div className="shell-sidebar-brand-area">
            <div className="brand-logo-box">
              <span>L</span>
            </div>
            <div className="brand-dropdown">
              <strong>Dawit Teklebrhan Team</strong>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>

          <nav className="shell-nav">
            {navigationItems.map((item) => (
              <NavLink
                key={item.label}
                className={({ isActive }) =>
                  item.to === '#' ? 'shell-nav-link dummy' : isActive ? 'shell-nav-link is-active' : 'shell-nav-link'
                }
                to={item.to}
              >
                <div className="nav-icon-placeholder">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     {item.label === 'Home' && <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><polyline points="9 22 9 12 15 12 15 22"/></path>}
                     {item.label === 'Character Board' && <rect width="18" height="18" x="3" y="3" rx="2" ry="2"><path d="M3 9h18"/><path d="M9 21V9"/></rect>}
                     {item.label === 'Conversation' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>}
                     {item.label === 'Activity' && <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>}
                     {item.label === 'Templates' && <rect width="18" height="18" x="3" y="3" rx="2" ry="2"><path d="M3 9h18"/></rect>}
                     {item.label === 'Archive' && <polyline points="21 8 21 21 3 21 3 8"><rect width="22" height="5" x="1" y="3" rx="1"/><line x1="10" x2="14" y1="12" y2="12"/></polyline>}
                     {item.label === 'Help docs' && <circle cx="12" cy="12" r="10"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"><line x1="12" x2="12.01" y1="17" y2="17"/></path></circle>}
                   </svg>
                </div>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <section className="shell-recent">
            <div className="shell-recent-heading">
              <span className="section-eyebrow">Projects</span>
            </div>
            {books.length ? (
              <div className="shell-recent-list">
                {books.slice(0, 4).map((book) => (
                  <Link
                    key={book.textId}
                    className="shell-recent-card"
                    to={`/workspace/${book.textId}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="project-icon"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    <span className="shell-recent-copy">
                      <strong>{book.title}</strong>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="shell-recent-empty">
                Create a project to start.
              </div>
            )}
          </section>
          
          <div className="shell-sidebar-footer">
            <button className="user-profile-btn" onClick={onSignOut}>
               <div className="user-avatar">{getInitials(displayName)}</div>
               <span>Sign out</span>
            </button>
          </div>
        </aside>

        <div className="shell-workspace">
          <header className="shell-topbar">
            <label className="shell-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                aria-label="Search workspace"
                placeholder="Search workspace"
                value={workspaceSearch}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>

            <div className="shell-topbar-actions">
              <button className="secondary-button" type="button">
                Share
              </button>
              <Link className="primary-button" to="/">
                + New
              </Link>
            </div>
          </header>

          <main className="shell-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;
