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
        const res = await fetch('/api/tidbits/pulse-latest');
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
    return () => {
      isMounted = false;
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">Loading the latest update…</p>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">{error}</p>
      </section>
    );
  }

  // Fallback state (no pulse yet)
  if (!pulse || pulse.fallback) {
    return (
      <section className="module-card pulse-module">
        <h2 className="module-title">Weather Pulse</h2>
        <p className="module-subtle-text">No Weather Pulse update yet.</p>
      </section>
    );
  }

  // Normal render
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

      <p className="pulse-text">{pulse.text}</p>

      <p className="pulse-timestamp">
        {pulse.timestamp ? formatTimeAgo(pulse.timestamp) : ''}
      </p>
    </section>
  );
}
