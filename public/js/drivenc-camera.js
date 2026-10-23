const video = document.getElementById('driveNCVideo');
const button = document.getElementById('driveNCPlay');
const status = document.getElementById('driveNCStatus');
const stream = 'https://cfase04.services.ncdot.gov:8887/chan-5369_l/xflow.m3u8';
let player;
let timeout;

function unavailable() {
  clearTimeout(timeout);
  player?.destroy();
  player = null;
  video.removeAttribute('src');
  video.load();
  button.hidden = false;
  button.disabled = false;
  button.textContent = 'Retry live video';
  status.textContent = 'Live video is unavailable. The preview is a still; you can also open the source links.';
}

if (video && button && status) {
  video.addEventListener('error', unavailable);
  video.addEventListener('playing', () => {
    clearTimeout(timeout);
    status.textContent = '';
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Loading live video…';
    timeout = setTimeout(unavailable, 25000);
    try {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream;
      } else {
        const { default: Hls } = await import('https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.mjs');
        if (!button.disabled) return;
        if (!Hls.isSupported()) throw new Error('HLS unsupported');
        player = new Hls();
        player.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) unavailable();
        });
        player.loadSource(stream);
        player.attachMedia(video);
      }
      button.hidden = true;
      await video.play();
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        clearTimeout(timeout);
        status.textContent = 'Press play in the video controls to watch live.';
      } else {
        unavailable();
      }
    }
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(timeout);
    player?.destroy();
  });
}
