import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../public/828-sunset-radiance.html", import.meta.url), "utf8");
const refreshScript = await readFile(new URL("../tools/towercam-refresh/Refresh-Towercam.ps1", import.meta.url), "utf8");
const signerRoute = await readFile(new URL("../lib/api-routes/towercam/upload-signature.js", import.meta.url), "utf8");

test("Sunset Radiance uses the stable Cloudinary towercam asset", () => {
  assert.match(page, /avlweather_towercam_latest\.jpg/);
  assert.match(page, /UNCA_CACHE_BUCKET_MS = 15 \* 60 \* 1000/);
  assert.match(page, /bucketedCacheUrl\(UNCA_CAMERA_URL, UNCA_CACHE_BUCKET_MS\)/);
  assert.doesNotMatch(page, /wlos\.com\/resources\/ftptransfer\/wlos\/maps\/Cam%20UNCA%20EcoNet\.png/);
});

test("local refresh gates work before publishing one overwritten asset", () => {
  assert.match(refreshScript, /-Method Head/);
  assert.match(refreshScript, /SourceImageUrl = "https:\/\/www\.atms\.unca\.edu\/currwx\/towercam\.jpg"/);
  assert.match(refreshScript, /SourceVideoUrl = "https:\/\/www\.atms\.unca\.edu\/currwx\/towercamarchive\/towercam\.mp4"/);
  assert.match(refreshScript, /-sseof", "-0\.5"/);
  assert.match(refreshScript, /Get-FileHash[^\n]+SHA256/);
  assert.match(refreshScript, /public_id=\$CloudinaryPublicId/);
  assert.match(refreshScript, /overwrite=true/);
  assert.match(refreshScript, /invalidate=true/);
  assert.match(refreshScript, /towercam\/upload-signature/);
});

test("towercam signer is token-protected and cannot choose arbitrary asset IDs", () => {
  assert.match(signerRoute, /process\.env\.TOWERCAM_REFRESH_TOKEN/);
  assert.match(signerRoute, /timingSafeEqual/);
  assert.match(signerRoute, /PUBLIC_ID = "avlweather_towercam_latest"/);
  assert.match(signerRoute, /Cache-Control", "no-store"/);
});

test("towercam signer returns a valid fixed-asset Cloudinary signature", async (t) => {
  const original = {
    token: process.env.TOWERCAM_REFRESH_TOKEN,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
    cloud: process.env.CLOUDINARY_CLOUD_NAME
  };
  t.after(() => {
    for (const [name, value] of Object.entries({
      TOWERCAM_REFRESH_TOKEN: original.token,
      CLOUDINARY_API_KEY: original.key,
      CLOUDINARY_API_SECRET: original.secret,
      CLOUDINARY_CLOUD_NAME: original.cloud
    })) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
  });

  process.env.TOWERCAM_REFRESH_TOKEN = "test-refresh-token";
  process.env.CLOUDINARY_API_KEY = "test-api-key";
  process.env.CLOUDINARY_API_SECRET = "test-api-secret";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";

  const { default: handler } = await import(`../lib/api-routes/towercam/upload-signature.js?test=${Date.now()}`);
  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  await handler({ method: "POST", headers: { authorization: "Bearer test-refresh-token" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.body.public_id, "avlweather_towercam_latest");
  const payload = `invalidate=true&overwrite=true&public_id=avlweather_towercam_latest&timestamp=${response.body.timestamp}test-api-secret`;
  assert.equal(response.body.signature, crypto.createHash("sha1").update(payload).digest("hex"));
});
