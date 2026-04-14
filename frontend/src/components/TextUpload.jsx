import { startTransition, useDeferredValue, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './TextUpload.css';
import apiService from '../services/api';
import {
  countSavedConversations,
  deriveWorkspaceTitle,
  formatRelativeDate,
  formatSourceType,
  getInitials,
  truncateText,
} from '../lib/formatters';
import { upsertWorkspaceBook } from '../lib/workspaceStore';

function TextUpload({ ownerKey, session, workspace, searchQuery, onWorkspaceChanged }) {
  const [entryMode, setEntryMode] = useState('text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('server_default');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
  const filteredBooks = workspace.books.filter((book) => {
    if (!normalizedSearch) {
      return true;
    }

    const searchableCharacters = book.characters.map((character) => character.name).join(' ');
    const searchableValue = [book.title, book.preview, searchableCharacters]
      .join(' ')
      .toLowerCase();

    return searchableValue.includes(normalizedSearch);
  });

  const totalCharacters = workspace.books.reduce(
    (total, book) => total + book.characters.length,
    0,
  );
  const totalConversations = workspace.books.reduce(
    (total, book) => total + countSavedConversations(book),
    0,
  );

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;

    if (selectedFile && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please upload a PDF file for document import.');
      return;
    }

    setErrorMessage('');
    setFile(selectedFile);
  };

  const resetDraft = () => {
    setTitle('');
    setText('');
    setFile(null);
    setProvider('server_default');
    setEntryMode('text');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (entryMode === 'text' && !text.trim()) {
      setErrorMessage('Paste a story excerpt before extracting characters.');
      return;
    }

    if (entryMode === 'pdf' && !file) {
      setErrorMessage('Choose a PDF file before extracting characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const characters = await apiService.extractCharacters({
        text: entryMode === 'text' ? text.trim() : undefined,
        file: entryMode === 'pdf' ? file : undefined,
        llmProvider: provider === 'server_default' ? undefined : provider,
        accessToken: session.access_token,
      });

      if (!Array.isArray(characters) || characters.length === 0) {
        throw new Error(
          'The backend did not return any characters. Try a richer excerpt or a more complete PDF.',
        );
      }

      const textId = characters[0].text_id;

      upsertWorkspaceBook(ownerKey, {
        textId,
        title: deriveWorkspaceTitle({
          title,
          text,
          fileName: file?.name,
        }),
        preview:
          entryMode === 'text'
            ? truncateText(text.trim(), 240)
            : `Imported from ${file?.name}`,
        sourceType: entryMode,
        sourceLabel: entryMode === 'pdf' ? file?.name : 'Pasted manuscript excerpt',
        preferredProvider: provider,
        characters,
      });

      setSuccessMessage('Character board created. Opening the workspace now.');

      startTransition(() => {
        onWorkspaceChanged();
        navigate(`/workspace/${textId}`);
      });

      resetDraft();
    } catch (error) {
      setErrorMessage(error.message || 'Character extraction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-overview grid-cards">
        <article className="overview-card surface-card">
          <span className="section-eyebrow">Library snapshot</span>
          <strong>{workspace.books.length}</strong>
          <span>Books in your studio</span>
        </article>
        <article className="overview-card surface-card">
          <span className="section-eyebrow">Extracted cast</span>
          <strong>{totalCharacters}</strong>
          <span>Character profiles saved</span>
        </article>
        <article className="overview-card surface-card">
          <span className="section-eyebrow">Conversation memory</span>
          <strong>{totalConversations}</strong>
          <span>Chat threads cached locally</span>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="composer-card surface-card" id="create-workspace">
          <span className="section-eyebrow">New book workspace</span>
          <h2 className="card-title">Upload the source material that should anchor the conversation.</h2>
          <p className="card-copy">
            This keeps the UI simple for readers: one source in, one character
            board out, then a direct path into the conversation studio.
          </p>

          {errorMessage ? <div className="alert-banner">{errorMessage}</div> : null}
          {successMessage ? <div className="success-banner">{successMessage}</div> : null}

          <form className="composer-form" onSubmit={handleSubmit}>
            <div className="composer-mode-switch">
              <button
                type="button"
                className={entryMode === 'text' ? 'mode-chip is-active' : 'mode-chip'}
                onClick={() => setEntryMode('text')}
              >
                Paste text
              </button>
              <button
                type="button"
                className={entryMode === 'pdf' ? 'mode-chip is-active' : 'mode-chip'}
                onClick={() => setEntryMode('pdf')}
              >
                Upload PDF
              </button>
            </div>

            <div className="composer-fields">
              <label>
                <span className="field-label">Workspace title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional. Otherwise we’ll derive one from the source."
                />
              </label>

              <label>
                <span className="field-label">Model provider</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="server_default">Use server default</option>
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
                <p className="field-hint">
                  Keep it on server default unless you want to test a specific
                  provider for this book.
                </p>
              </label>

              {entryMode === 'text' ? (
                <label>
                  <span className="field-label">Story excerpt</span>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Paste the story, chapter, or manuscript excerpt here..."
                  />
                </label>
              ) : (
                <label className="file-dropzone">
                  <span className="field-label">PDF document</span>
                  <input
                    accept="application/pdf"
                    onChange={handleFileChange}
                    type="file"
                  />
                  <span className="file-dropzone-copy">
                    {file ? file.name : 'Choose a PDF from your computer'}
                  </span>
                  <p className="field-hint">
                    The backend extracts text from the PDF before building the
                    cast board.
                  </p>
                </label>
              )}
            </div>

            <div className="composer-actions">
              <button className="primary-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Extracting characters...' : 'Create character board'}
              </button>
              <button className="secondary-button" onClick={resetDraft} type="button">
                Reset draft
              </button>
            </div>
          </form>
        </article>

        <aside className="dashboard-notes surface-card">
          <span className="section-eyebrow">What happens next</span>
          <h3>Keep the workflow gentle for the user.</h3>
          <ul className="dashboard-note-list">
            <li>Start with one clearly bounded source so the cast stays coherent.</li>
            <li>Choose the strongest character on the board before opening chat.</li>
            <li>Reuse the same workspace if you want long-term emotional drift.</li>
          </ul>
        </aside>
      </section>

      <section className="library-section">
        <div className="library-section-heading">
          <div>
            <span className="section-eyebrow">Library</span>
            <h2 className="card-title">Continue an existing book workspace.</h2>
            <p className="card-copy">
              Search across titles and character names from the top bar, then open the book you want.
            </p>
          </div>
        </div>

        {filteredBooks.length ? (
          <div className="library-grid">
            {filteredBooks.map((book) => (
              <article className="library-card surface-card" key={book.textId}>
                <div className="library-card-cover">
                  <span>{getInitials(book.title)}</span>
                </div>

                <div className="library-card-copy">
                  <div className="library-card-topline">
                    <span className="outline-pill">{formatSourceType(book.sourceType)}</span>
                    <span className="outline-pill">{book.characters.length} characters</span>
                  </div>

                  <h3>{book.title}</h3>
                  <p>{book.preview || 'A saved book workspace with extracted characters.'}</p>

                  <div className="library-card-meta">
                    <span>Updated {formatRelativeDate(book.updatedAt)}</span>
                    <span>{countSavedConversations(book)} saved chats</span>
                  </div>

                  <div className="library-card-actions">
                    <Link className="secondary-button" to={`/workspace/${book.textId}`}>
                      Open board
                    </Link>
                    {book.activeCharacterId ? (
                      <Link
                        className="ghost-button"
                        to={`/chat/${book.textId}/${book.activeCharacterId}`}
                      >
                        Resume chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state surface-card">
            <h3>No library entries match the current search.</h3>
            <p>
              Clear the search box or create a new workspace from the composer
              above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default TextUpload;
