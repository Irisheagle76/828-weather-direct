import { spawn } from "node:child_process";
import { CAMERAS } from "../../public/mobile/live-look.js";

const camera = CAMERAS.find(camera => camera.id === "chamber");
const player = new URL(camera.embed);
const stream = `https://svrhearst.videstra.live/hls_output/${player.searchParams.get("id")}_${player.searchParams.get("token")}/index.m3u8`;
let snapshot = null;
let pending = null;
let failed = false;

export function getChamberSnapshot() { return snapshot; }
export function getChamberStatus() {
  return { capturedAt: snapshot?.capturedAt || null, available: !!snapshot, refreshFailed: failed, refreshIntervalSeconds: 300 };
}

// One local capture shared by every preview visitor. Never run FFmpeg per request.
export function refreshChamberSnapshot() {
  if (pending) return pending;
  pending = new Promise(resolve => {
    const process = spawn(processEnvFfmpeg(), ["-hide_banner", "-loglevel", "error", "-threads", "1", "-rw_timeout", "15000000", "-i", stream, "-frames:v", "1", "-vf", "scale=960:-2", "-c:v", "mjpeg", "-threads:v", "1", "-q:v", "4", "-f", "image2pipe", "pipe:1"], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    let size = 0;
    const timeout = setTimeout(() => process.kill(), 30000);
    process.stdout.on("data", chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) process.kill(); else chunks.push(chunk); });
    const finish = code => {
      clearTimeout(timeout);
      const image = Buffer.concat(chunks);
      if (code === 0 && size <= 2 * 1024 * 1024 && image[0] === 255 && image[1] === 216 && image.at(-2) === 255 && image.at(-1) === 217) {
        snapshot = { image, capturedAt: new Date().toISOString() };
        failed = false;
      } else failed = true;
      resolve();
    };
    process.once("error", () => { failed = true; clearTimeout(timeout); resolve(); });
    process.once("close", finish);
  }).finally(() => { pending = null; });
  return pending;
}

function processEnvFfmpeg() { return process.env.MOBILE_PREVIEW_FFMPEG || "ffmpeg"; }

export function startChamberSnapshots() {
  refreshChamberSnapshot();
  const timer = setInterval(refreshChamberSnapshot, 300000);
  timer.unref();
}
