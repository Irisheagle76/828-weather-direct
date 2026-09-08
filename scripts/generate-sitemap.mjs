import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PUBLIC_PAGES, SITE_ORIGIN } from "./seo-pages.mjs";

const urls = PUBLIC_PAGES.map(({ pathname }) => `  <url><loc>${SITE_ORIGIN}${pathname}</loc></url>`).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(path.join(projectRoot, "public", "sitemap.xml"), xml, "utf8");
console.log(`Wrote sitemap.xml with ${PUBLIC_PAGES.length} canonical URLs.`);
