import { useDeferredValue } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import './TextUpload.css';
import { formatSourceType, getInitials } from '../lib/formatters';

function TextUpload({ workspace, searchQuery }) {
  const { setIsModalOpen } = useOutletContext();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  
  const filteredBooks = workspace.books.filter((book) => {
    if (!normalizedSearch) return true;
    const searchableCharacters = book.characters.map((character) => character.name).join(' ');
    const searchableValue = [book.title, book.preview, searchableCharacters].join(' ').toLowerCase();
    return searchableValue.includes(normalizedSearch);
  });

  return (
    <div className="dashboard-page">
      <section className="dashboard-page-header">
        <div className="dashboard-breadcrumbs">
          <span>Dawit Teklebrhan Team</span>
          <span>/</span>
          <span>Welcome to Lorely!</span>
        </div>
        <h1>Welcome to Lorely!</h1>
        <p>Your dream character simulation workflow starts here.</p>
      </section>

      <section className="dashboard-grid-section">
        <div className="dashboard-section-header">
          <span>BOOKS ({workspace.books.length})</span>
          <div className="dashboard-section-actions">
             <button className="ghost-button icon-button" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
             </button>
             <button className="ghost-button icon-button" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
             </button>
          </div>
        </div>

        <div className="library-grid">
          {/* Create New Book Card */}
          <button className="new-book-card" onClick={() => setIsModalOpen(true)}>
            <div className="new-book-icon">
               <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            </div>
            <span>New book</span>
          </button>

          {/* Existing Books */}
          {filteredBooks.map((book) => (
            <Link key={book.textId} className="library-card surface-card" to={`/workspace/${book.textId}`}>
              <div className="library-card-cover">
                <span>{getInitials(book.title)}</span>
              </div>
              <div className="library-card-copy">
                <h3>{book.title}</h3>
                <div className="library-card-meta">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                   <span>{book.characters.length} characters</span>
                </div>
                <div className="library-card-meta">
                   {book.sourceType === 'pdf' ? 
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                     : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                   }
                   <span>{formatSourceType(book.sourceType)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default TextUpload;
