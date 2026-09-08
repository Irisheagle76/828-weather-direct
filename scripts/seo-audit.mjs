import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EXCLUDED_HTML, PUBLIC_PAGES, SITE_ORIGIN } from "./seo-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const errors = [];
const warnings = [];
const titles = new Map();
const descriptions = new Map();

const clean = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const one = (html, regex) => clean(html.match(regex)?.[1] || "");
function meta(html, name, key = "name") {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return one(html, new RegExp(`<meta\\b[^>]*${key}=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i")) || one(html, new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*${key}=["']${escaped}["']`, "i"));
}
function canonical(html) {
  return one(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || one(html, /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
}
function unique(map, value, kind, file) {
  if (map.has(value)) errors.push(`${file}: duplicate ${kind} also used by ${map.get(value)}`);
  else map.set(value, file);
}
function localFile(current, value) {
  if (!value || value.startsWith("#") || value.includes("${") || /^(?:[a-z]+:)?\/\//i.test(value) || /^(?:mailto|tel|data|javascript):/i.test(value)) return null;
  let target = value.split(/[?#]/)[0];
  if (!target) return null;
  target = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(current), target));
  if (!target) target = "index.html";
  if (target.endsWith("/")) target += "index.html";
  return target.replaceAll("/", path.sep);
}
async function exists(target) { try { return (await stat(target)).isFile(); } catch { return false; } }

for (const page of PUBLIC_PAGES) {
  const html = await readFile(path.join(publicRoot, page.file), "utf8");
  const title = one(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const description = meta(html, "description");
  const canonicalUrl = canonical(html);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => clean(match[1]));
  if (!title) errors.push(`${page.file}: missing title`); else unique(titles, title, "title", page.file);
  if (!description) errors.push(`${page.file}: missing description`); else unique(descriptions, description, "description", page.file);
  if (canonicalUrl !== `${SITE_ORIGIN}${page.pathname}`) errors.push(`${page.file}: canonical mismatch (${canonicalUrl || "missing"})`);
  if (!/^index,follow/i.test(meta(html, "robots"))) errors.push(`${page.file}: missing index,follow directive`);
  if (h1s.length !== 1) errors.push(`${page.file}: expected one H1, found ${h1s.length}`);
  for (const field of ["title", "description", "url", "image", "site_name"]) if (!meta(html, `og:${field}`, "property")) errors.push(`${page.file}: missing og:${field}`);
  for (const field of ["card", "title", "description", "image"]) if (!meta(html, `twitter:${field}`)) errors.push(`${page.file}: missing twitter:${field}`);
  if (!/<link\b[^>]*rel=["']icon["']/i.test(html)) errors.push(`${page.file}: missing favicon`);
  if (/localhost|127\.0\.0\.1|vercel\.app/i.test(canonicalUrl + meta(html, "og:url", "property"))) errors.push(`${page.file}: development hostname in metadata`);
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) errors.push(`${page.file}: missing JSON-LD`);
  for (const block of blocks) try { JSON.parse(block[1]); } catch (error) { errors.push(`${page.file}: invalid JSON-LD (${error.message})`); }
  for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(image[1])) errors.push(`${page.file}: image without alt`);
    const target = localFile(page.file, one(image[1], /\bsrc=["']([^"']*)["']/i));
    if (target && !(await exists(path.join(publicRoot, target)))) errors.push(`${page.file}: missing local image ${target}`);
  }
  for (const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = link[1];
    const target = localFile(page.file, href);
    if (target && !(await exists(path.join(publicRoot, target)))) errors.push(`${page.file}: broken internal link ${href}`);
    const fragment = href.includes("#") ? decodeURIComponent(href.split("#").pop()) : "";
    if (fragment && !/^(?:[a-z]+:)?\/\//i.test(href) && !href.includes("${")) {
      const targetHtml = href.startsWith("#") ? html : target ? await readFile(path.join(publicRoot, target), "utf8") : "";
      if (!targetHtml.includes(`id="${fragment}"`) && !targetHtml.includes(`id='${fragment}'`) && !targetHtml.includes(`name="${fragment}"`) && !targetHtml.includes(`name='${fragment}'`)) {
        errors.push(`${page.file}: broken internal anchor ${href}`);
      }
    }
  }
  if (title.length > 65) warnings.push(`${page.file}: title is ${title.length} characters`);
  if (description.length > 165) warnings.push(`${page.file}: description is ${description.length} characters`);
  console.log(`${page.pathname}\t${title}\t${h1s.join(" | ")}\t${page.intent}`);
}

const sitemap = await readFile(path.join(publicRoot, "sitemap.xml"), "utf8");
const actualUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expectedUrls = PUBLIC_PAGES.map(({ pathname }) => `${SITE_ORIGIN}${pathname}`);
if (JSON.stringify(actualUrls) !== JSON.stringify(expectedUrls)) errors.push("sitemap does not match public page inventory");
const robots = await readFile(path.join(publicRoot, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) errors.push("robots.txt is missing sitemap reference");
const disallowedPaths = new Set(
  [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((match) => match[1].replace(/^\//, ""))
);

const htmlFiles = [];
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), relative);
    else if (entry.name.endsWith(".html")) htmlFiles.push(relative);
  }
}
await collect(publicRoot);
const classified = new Set([...PUBLIC_PAGES.map(({ file }) => file), ...EXCLUDED_HTML]);
for (const file of htmlFiles) if (!file.startsWith("admin/") && !classified.has(file)) errors.push(`${file}: unclassified HTML page`);
for (const file of EXCLUDED_HTML) {
  const excludedPath = path.join(publicRoot, file);
  if (!(await exists(excludedPath))) continue;
  const html = await readFile(excludedPath, "utf8");
  const isNoindex = /^noindex/i.test(meta(html, "robots"));
  const isDisallowed = [...disallowedPaths].some((rule) => file === rule || file.startsWith(rule));
  const isPermanentRedirectSource = file === "sunset.html";
  if (!isNoindex && !isDisallowed && !isPermanentRedirectSource) errors.push(`${file}: excluded page lacks an indexing control`);
}
for (const file of htmlFiles.filter((entry) => entry.startsWith("admin/"))) {
  const html = await readFile(path.join(publicRoot, file), "utf8");
  if (!/^noindex/i.test(meta(html, "robots"))) errors.push(`${file}: admin page lacks noindex`);
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length) { console.error(`SEO audit failed with ${errors.length} error(s).`); process.exitCode = 1; }
else console.log(`SEO audit passed for ${PUBLIC_PAGES.length} public pages with ${warnings.length} warning(s).`);
