// Preserve the composer's formatting while discarding executable markup.
export function sanitizeEditorialHtml(html, baseUrl = window.location.origin) {
  const template = document.createElement('template');
  template.innerHTML = html || '';
  const allowedTags = new Set(['A', 'B', 'BR', 'CODE', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'STRONG', 'U', 'UL', 'BLOCKQUOTE', 'H3', 'H4']);
  const allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
  const discardTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']);

  function clean(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || discardTags.has(child.tagName)) {
        child.remove();
        continue;
      }
      clean(child);
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      const rawHref = child.tagName === 'A' ? child.getAttribute('href') : null;
      for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
      if (child.tagName === 'A') {
        let url;
        try { url = rawHref?.trim() ? new URL(rawHref, baseUrl) : null; } catch { url = null; }
        if (!url || !allowedProtocols.has(url.protocol)) {
          child.replaceWith(...Array.from(child.childNodes));
          continue;
        }
        child.setAttribute('href', url.href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
  clean(template.content);
  return template.innerHTML.trim();
}
