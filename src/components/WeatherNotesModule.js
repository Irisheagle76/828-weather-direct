import { useEffect, useState } from 'react';
import { fetchSubstackNotes } from '../services/substackApi';
import { formatTimeAgo } from '../utils/timeFormatting';
import { sanitizeHtmlSnippet } from '../utils/htmlSanitizer';

export default function WeatherNotesModule() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNotes() {
      try {
        const data = await fetchSubstackNotes();
        if (isMounted) {
          setNotes(data || []);
          setError(null);
        }
      } catch (err) {
        console.error('WeatherNotesModule error:', err);
        if (isMounted) setError('Unable to load Weather Notes right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadNotes();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Notes</h2>
        <p className="module-subtle-text">Loading the latest notes…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Notes</h2>
        <p className="module-subtle-text">{error}</p>
      </section>
    );
  }

  if (!notes.length) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Notes</h2>
        <p className="module-subtle-text">No recent notes just yet.</p>
      </section>
    );
  }

  return (
    <section className="module-card substack-module">
      <h2 className="module-title">Weather Notes</h2>
      <ul className="substack-notes-list">
        {notes.map((note, index) => {
          const snippet = sanitizeHtmlSnippet(note.description || '').slice(0, 220);
          const showEllipsis = snippet.length === 220;

          return (
            <li key={index} className="substack-note-item">
              <div className="substack-note-meta">
                <span className="substack-note-time">
                  {formatTimeAgo(note.pubDate)}
                </span>
              </div>
              <div
                className="substack-note-snippet"
                dangerouslySetInnerHTML={{
                  __html: showEllipsis ? `${snippet}…` : snippet,
                }}
              />
              <a
                href={note.link}
                className="substack-note-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on Substack →
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
