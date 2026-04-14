import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import './AppShell.css';
import {
  countSavedConversations,
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

  const totalCharacters = books.reduce(
    (total, book) => total + book.characters.length,
    0,
  );
  const totalConversations = books.reduce(
    (total, book) => total + countSavedConversations(book),
    0,
  );

  const navigationItems = [
    {
      label: 'Library',
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
  ];

  const currentPathMeta = getPathMeta(location.pathname, currentBook);
  const displayName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email ||
    'Reader';

  return (
    <div className="shell-page">
      <div className="shell-banner">
        <span>Keep every uploaded book, extracted cast, and live conversation inside one account-owned workspace.</span>
        <Link className="shell-banner-link" to="/">
          View library
        </Link>
      </div>

      <div className="shell-layout">
        <aside className="shell-rail">
          <Link className="shell-rail-brand" to="/">
            <span>CS</span>
          </Link>
          <div className="shell-rail-stack">
            <span className="shell-rail-token is-active" />
            <span className="shell-rail-token" />
            <span className="shell-rail-token" />
          </div>
          <button className="shell-rail-avatar" type="button">
            {getInitials(displayName)}
          </button>
        </aside>

        <aside className="shell-sidebar">
          <div className="shell-sidebar-header">
            <div>
              <strong>{displayName}</strong>
              <span>Private character workspace</span>
            </div>
          </div>

          <nav className="shell-nav">
            {navigationItems.map((item) => (
              <NavLink
                key={item.label}
                className={({ isActive }) =>
                  isActive ? 'shell-nav-link is-active' : 'shell-nav-link'
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <section className="shell-summary surface-card">
            <span className="section-eyebrow">Workspace</span>
            <div className="shell-summary-grid">
              <article>
                <strong>{books.length}</strong>
                <span>Books</span>
              </article>
              <article>
                <strong>{totalCharacters}</strong>
                <span>Characters</span>
              </article>
              <article>
                <strong>{totalConversations}</strong>
                <span>Saved chats</span>
              </article>
            </div>
          </section>

          <section className="shell-recent">
            <div className="shell-recent-heading">
              <span className="section-eyebrow">Recent books</span>
            </div>
            {books.length ? (
              <div className="shell-recent-list">
                {books.slice(0, 4).map((book) => (
                  <Link
                    key={book.textId}
                    className="shell-recent-card"
                    to={`/workspace/${book.textId}`}
                  >
                    <span className="shell-recent-initials">
                      {getInitials(book.title)}
                    </span>
                    <span className="shell-recent-copy">
                      <strong>{book.title}</strong>
                      <small>{formatRelativeDate(book.updatedAt)}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="shell-recent-empty surface-card">
                Upload a book to start building the library.
              </div>
            )}
          </section>

          <section className="shell-tip surface-card">
            <span className="section-eyebrow">Workflow</span>
            <h3>Best experience</h3>
            <p>
              Upload the source first, open the character board to choose the
              strongest persona, then move into the chat studio once the dossier
              feels right.
            </p>
          </section>
        </aside>

        <div className="shell-workspace">
          <header className="shell-topbar">
            <label className="shell-search">
              <input
                aria-label="Search workspace"
                placeholder="Search books, characters, and saved conversations"
                value={workspaceSearch}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>

            <div className="shell-topbar-actions">
              <Link className="secondary-button" to="/">
                Open library
              </Link>
              <Link className="primary-button" to="/">
                + New book
              </Link>
              <button className="ghost-button" onClick={onSignOut} type="button">
                Sign out
              </button>
            </div>
          </header>

          <main className="shell-main">
            <section className="shell-page-header">
              <div className="shell-breadcrumbs">
                <span>Character Studio</span>
                <span>/</span>
                <span>{currentPathMeta.crumb}</span>
                {currentBook ? (
                  <>
                    <span>/</span>
                    <span>{currentBook.title}</span>
                  </>
                ) : null}
              </div>
              <h1>{currentPathMeta.title}</h1>
              <p>{currentPathMeta.description}</p>
            </section>

            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function getPathMeta(pathname, currentBook) {
  if (matchPath('/chat/:textId/:characterId', pathname)) {
    return {
      crumb: 'Conversation',
      title: currentBook ? `Chat inside ${currentBook.title}` : 'Conversation Studio',
      description:
        'Stay grounded in the source text while the character state evolves turn by turn.',
    };
  }

  if (matchPath('/workspace/:textId', pathname)) {
    return {
      crumb: 'Character Board',
      title: currentBook ? `Cast board for ${currentBook.title}` : 'Character Board',
      description:
        'Review the extracted cast, compare their emotional profile, and choose who should lead the next conversation.',
    };
  }

  return {
    crumb: 'Library',
    title: 'Your book library',
    description:
      'Bring in a manuscript or PDF, keep the output tidy, and return to every conversation from one calm dashboard.',
  };
}

export default AppShell;
