// Human-friendly "time ago" formatting for Substack timestamps

export function formatTimeAgo(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    // Fallback to a simple date for older content
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  return 'Just now';
}
