import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import './AppShell.css';
import UploadModal from './UploadModal';
import { getInitials } from '../lib/formatters';

function AppShell({ session, workspace, workspaceSearch, onSearchChange, onSignOut, onWorkspaceChanged }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  
  const activeTextId =
    matchPath('/workspace/:textId', location.pathname)?.params.textId ||
    matchPath('/chat/:textId/:characterId', location.pathname)?.params.textId ||
    null;

  const books = workspace.books || [];
  const latestBook = books[0] || null;
  const currentBook = books.find((book) => book.textId === activeTextId) || latestBook;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigationItems = [
    { label: 'Library', to: '/' },
    { label: 'Characters', to: currentBook ? `/workspace/${currentBook.textId}` : '/' },
    { 
      label: 'Conversations', 
      to: currentBook && currentBook.activeCharacterId
          ? `/chat/${currentBook.textId}/${currentBook.activeCharacterId}`
          : currentBook ? `/workspace/${currentBook.textId}` : '/' 
    },
    { label: 'Settings', to: '#' }
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
                     {item.label === 'Library' && <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><polyline points="9 22 9 12 15 12 15 22"/></path>}
                     {item.label === 'Characters' && <rect width="18" height="18" x="3" y="3" rx="2" ry="2"><path d="M3 9h18"/><path d="M9 21V9"/></rect>}
                     {item.label === 'Conversations' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>}
                     {item.label === 'Settings' && <circle cx="12" cy="12" r="10"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"><line x1="12" x2="12.01" y1="17" y2="17"/></path></circle>}
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
              <div className="shell-notification">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span className="notification-badge">1</span>
              </div>

              <div className="shell-account-wrapper" ref={dropdownRef}>
                <button className="user-avatar-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <div className="user-avatar-circle">{getInitials(displayName)}</div>
                </button>
                
                {isDropdownOpen && (
                  <div className="account-dropdown">
                     <div className="dropdown-header">
                       <div className="dropdown-avatar-circle">{getInitials(displayName)}</div>
                       <div className="dropdown-user-info">
                         <strong>{displayName}</strong>
                         <span>SuperAdmin</span>
                       </div>
                     </div>
                     <div className="dropdown-divider"></div>
                     <button className="dropdown-item">Account Setting</button>
                     <button className="dropdown-item">Help and support</button>
                     <button className="dropdown-item" onClick={onSignOut}>Log Out</button>
                  </div>
                )}
              </div>

              <button className="primary-button" onClick={() => setIsModalOpen(true)}>
                + New
              </button>
            </div>
          </header>

          <main className="shell-main">
            <Outlet context={{ setIsModalOpen }} />
          </main>
        </div>
      </div>
      
      <UploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        ownerKey={session.user.id} 
        session={session} 
        onWorkspaceChanged={onWorkspaceChanged} 
      />
    </div>
  );
}

export default AppShell;
