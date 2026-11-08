import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import AddBookModal from '../../components/AddBookModal';
import './AdminCatalog.css';

export default function AdminCatalog() {
  const { accessToken } = useOutletContext();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadBooks() {
      try {
        const list = await lorelyApi.adminListBooks(accessToken);
        if (mounted) setBooks(list);
      } catch (err) {
        // Fall back gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBooks();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleToggleFeatured = async (book) => {
    const nextVisibility = book.visibility === 'featured' ? 'public' : 'featured';
    setUpdatingId(book.id);

    try {
      const updated = await lorelyApi.adminUpdateBook(
        book.id,
        { visibility: nextVisibility },
        accessToken,
      );
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, visibility: updated.visibility } : b)),
      );
    } catch (err) {
      // Error handling
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="admin-catalog-view" data-testid="admin-catalog">
      <header className="catalog-header-line">
        <div>
          <h1 className="catalog-title">Catalogue & Featured Works</h1>
          <p className="catalog-sub">
            Manage public availability, showcase masterpieces on the homepage, and inspect library ownership.
          </p>
        </div>

        <button
          type="button"
          className="admin-add-catalog-btn"
          onClick={() => setIsAddBookOpen(true)}
        >
          <span>➕</span> Add Book to Shared Catalog
        </button>
      </header>

      {loading ? (
        <p className="admin-subtext">Loading catalogue entries...</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-telemetry-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Owner</th>
                <th>Characters</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td className="book-title-cell">
                    <strong>{book.title}</strong>
                  </td>
                  <td>{book.author || '—'}</td>
                  <td>{book.owner_email}</td>
                  <td>{book.character_count}</td>
                  <td>
                    <span className={`visibility-pill pill-${book.visibility}`}>
                      {book.visibility}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`feature-toggle-btn ${book.visibility === 'featured' ? 'unfeature' : 'feature'}`}
                      disabled={updatingId === book.id}
                      onClick={() => handleToggleFeatured(book)}
                    >
                      {book.visibility === 'featured' ? '★ Unfeature' : '☆ Feature on Home'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddBookModal
        isOpen={isAddBookOpen}
        onClose={() => setIsAddBookOpen(false)}
        accessToken={accessToken}
        defaultVisibility="featured"
        isSharedCatalog={true}
        onBookAdded={(newBook) => {
          setBooks((prev) => [
            {
              id: newBook.id,
              title: newBook.title,
              author: newBook.author,
              owner_email: 'Curator / Admin',
              character_count: newBook.character_count || newBook.characters?.length || 0,
              visibility: newBook.visibility || 'featured',
            },
            ...prev,
          ]);
        }}
      />
    </div>
  );
}
