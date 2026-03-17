// Very conservative HTML sanitizer for Substack snippets
// Strips all tags except basic inline formatting.

export function sanitizeHtmlSnippet(html) {
  if (!html) return '';

  // Remove script/style tags entirely
  let cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Allow only a small set of tags: <b>, <strong>, <i>, <em>, <br>, <p>
  cleaned = cleaned.replace(/<(?!\/?(b|strong|i|em|br|p)\b)[^>]*>/gi, '');

  return cleaned.trim();
}
