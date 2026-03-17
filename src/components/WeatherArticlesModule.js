import { useEffect, useState } from 'react';
import { fetchSubstackLatestArticle } from '../services/substackApi';
import { formatTimeAgo } from '../utils/timeFormatting';
import { sanitizeHtmlSnippet } from '../utils/htmlSanitizer';

export default function WeatherArticlesModule() {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadArticle() {
      try {
        const data = await fetchSubstackLatestArticle();
        if (isMounted) {
          setArticle(data);
          setError(null);
        }
      } catch (err) {
        console.error('WeatherArticlesModule error:', err);
        if (isMounted) setError('Unable to load the latest article right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Articles</h2>
        <p className="module-subtle-text">Loading the latest article…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Articles</h2>
        <p className="module-subtle-text">{error}</p>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="module-card substack-module">
        <h2 className="module-title">Weather Articles</h2>
        <p className="module-subtle-text">No recent articles just yet.</p>
      </section>
    );
  }

  const snippet = sanitizeHtmlSnippet(article.description || '');
  const shortSnippet = snippet.slice(0, 500);
  const showEllipsis = shortSnippet.length === 500;

  return (
    <section className="module-card substack-module">
      <h2 className="module-title">Weather Articles</h2>
      <header className="substack-article-header">
        <h3 className="substack-article-title">{article.title}</h3>
        <span className="substack-article-time">
          {formatTimeAgo(article.pubDate)}
        </span>
      </header>
      <div
        className="substack-article-snippet"
        dangerouslySetInnerHTML={{
          __html: showEllipsis ? `${shortSnippet}…` : shortSnippet,
        }}
      />
      <a
        href={article.link}
        className="substack-article-link"
        target="_blank"
        rel="noopener noreferrer"
      >
        Read full article →
      </a>
    </section>
  );
}
