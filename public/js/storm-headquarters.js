import { sanitizeEditorialHtml } from './intel/editorial-html.js';
import { getEventMedia } from './intel/pulse-media.js';

export function renderHeadquarters(container, post, options = {}) {
  container.querySelectorAll('video').forEach(video => video.pause());
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
  const mediaItems = getEventMedia(post, options);
  const dialog = document.createElement('dialog');
  dialog.className = 'storm-hq-dialog';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close ×';
  close.onclick = () => dialog.close();
  const viewer = document.createElement('div');
  dialog.append(close, viewer);
  dialog.addEventListener('close', () => {
    viewer.querySelector('video')?.pause();
    viewer.replaceChildren();
  });
  dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
  mediaItems.forEach(({ url, mediaType }, index) => {
    const isVideo = mediaType === 'video';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', isVideo ? `Play event video ${index + 1}` : `Enlarge tracking image ${index + 1}`);
    const img = document.createElement(isVideo ? 'video' : 'img');
    img.src = url;
    if (isVideo) {
      img.muted = true;
      img.playsInline = true;
      img.preload = 'metadata';
      if (url.includes('res.cloudinary.com/') && url.includes('/video/upload/')) {
        img.poster = url.replace('/upload/', '/upload/so_0,f_jpg,q_auto,w_640,c_limit/');
      }
    } else {
      img.alt = `${post.title || 'Weather event'} image ${index + 1}`;
      img.loading = 'lazy';
    }
    const hint = document.createElement('span');
    hint.textContent = isVideo ? `Video ${index + 1} · Click to play` : `Image ${index + 1} · Click to enlarge`;
    button.append(img, hint);
    button.onclick = () => {
      const enlarged = document.createElement(isVideo ? 'video' : 'img');
      enlarged.src = url;
      if (isVideo) {
        enlarged.controls = true;
        enlarged.autoplay = true;
        enlarged.playsInline = true;
        enlarged.setAttribute('aria-label', `${post.title || 'Weather event'} video ${index + 1}`);
      } else enlarged.alt = img.alt;
      viewer.replaceChildren(enlarged);
      dialog.showModal();
    };
    gallery.append(button);
  });
  card.append(gallery, dialog);
  container.append(card);
}
