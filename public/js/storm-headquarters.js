import { sanitizeEditorialHtml } from './intel/editorial-html.js';

export function renderHeadquarters(container, post) {
  container.replaceChildren();
  container.hidden = !post;
  if (!post) return;
  container.setAttribute('aria-label', post.title || 'Weather event headquarters');
  const card = document.createElement('article');
  card.className = 'storm-hq-card';
  const kicker = document.createElement('div');
  kicker.className = 'storm-hq-kicker';
  kicker.textContent = '828 WEATHER • EVENT HEADQUARTERS';
  const title = document.createElement('h2');
  title.textContent = post.title || 'Weather Event Headquarters';
  const time = document.createElement('p');
  time.className = 'storm-hq-time';
  const date = new Date(post.editedAt || post.timestamp);
  time.textContent = Number.isFinite(date.getTime()) ? `Tim’s latest thoughts • Updated ${date.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : 'Tim’s latest thoughts';
  const body = document.createElement('div');
  body.className = 'storm-hq-body editorial-rich-text';
  body.innerHTML = sanitizeEditorialHtml(post.text || '');
  card.append(kicker, title, time, body);
  const gallery = document.createElement('div');
  gallery.className = 'storm-hq-gallery';
  const images = Array.isArray(post.gallery) && post.gallery.length ? post.gallery : post.mediaType !== 'video' && post.mediaUrl ? [post.mediaUrl] : [];
  const dialog = document.createElement('dialog');
  dialog.className = 'storm-hq-dialog';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close ×';
  close.onclick = () => dialog.close();
  const enlarged = document.createElement('img');
  dialog.append(close, enlarged);
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  images.slice(0, 12).forEach((url, index) => {
    try { if (new URL(url).protocol !== 'https:') return; } catch { return; }
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', `Enlarge tracking image ${index + 1}`);
    const img = document.createElement('img');
    img.src = url;
    img.alt = `${post.title || 'Weather event'} image ${index + 1}`;
    img.loading = 'lazy';
    const hint = document.createElement('span');
    hint.textContent = `Image ${index + 1} · Click to enlarge`;
    button.append(img, hint);
    button.onclick = () => { enlarged.src = url; enlarged.alt = img.alt; dialog.showModal(); };
    gallery.append(button);
  });
  card.append(gallery, dialog);
  container.append(card);
}
