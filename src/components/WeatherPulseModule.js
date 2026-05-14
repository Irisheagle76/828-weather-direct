import { useEffect, useState } from 'react';
import { formatTimeAgo } from '../utils/timeFormatting';

export default function WeatherPulseModule() {
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPulse() {
      try {
        const res = await fetch('/api/router?route=tidbits/pulse-latest');
        const data = await res.json();

        if (isMounted) {
          setPulse(data);
          setError(null);
        }
      } catch (err) {
        console.error('WeatherPulseModule error:', err);
        if (isMounted) setError('Unable to load Weather Pulse right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPulse();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">Loading the latest update…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">{error}</p>
      </section>
    );
  }

  // FIXED: Only fallback when truly no pulse
  if (!pulse || (pulse.fallback && !pulse.text)) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">No Weather Pulse update yet.</p>
      </section>
    );
  }

  return (
    <section className="module-card pulse-module">
      <h2 className="module-title">{pulse.title}</h2>

      {pulse.mediaUrl && (
        <div className="pulse-image-wrapper">
          {pulse.mediaType === "video" ? (
            <video
              src={pulse.mediaUrl}
              className="pulse-image"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={pulse.mediaUrl}
              alt=""
              className="pulse-image"
              loading="lazy"
            />
          )}
        </div>
      )}

      <div
        className="pulse-text"
        dangerouslySetInnerHTML={{ __html: pulse.text }}
      />

      <p className="pulse-timestamp">
        {pulse.timestamp ? formatTimeAgo(pulse.timestamp) : ''}
      </p>
    </section>
  );
}
