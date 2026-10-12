# Site audit cleanup - October 12, 2026

These are local, uncommitted changes implementing the focused cleanup approved after reviewing the Meta Muse audit. Production has not been changed. Existing unrelated working-tree changes were preserved.

## Intended behavior

- Rainfall date-only records display an unambiguous month name: `20261011` becomes `Oct 11, 2026`. Invalid calendar dates display `--`; the formatter does not invent or change the underlying data date.
- Tomorrow's circular score has a persistent visible FeelScore label, including on mobile.
- A supplied editorial Pulse headline is preserved. Posts with a generic Weather Pulse title use a short opening sentence from their own text, so recent cards no longer repeat the same stock heading. These are excerpt titles, not invented headlines.
- The static Substack fallback is labeled Featured, including its accessible link and action. Latest is shown only after a dated feed post is returned. The feed API selects the newest published, dated item independently of RSS order and excludes scheduled or undated entries. The existing image-fallback flag remains separate from article freshness.
- Comfort Curve night shading remains behind the plotted line, with lighter shading and stronger band labels. Scores, points, NOW marker, and best-window math are unchanged.
- Public navigation pages have descriptions, canonical URLs, and Open Graph/Twitter metadata. Existing complete metadata on Hiking and Microscope was preserved. Sharing uses the existing brand image. The homepage adds WebSite and Organization structured data. No publication dates or article schema were invented for the Pulse archive.
- `robots.txt` allows crawling and links to a sitemap containing the 11 public navigation destinations. The sitemap omits admin, APIs, preview pages, and fabricated modification dates.
- Radar applies its existing color treatment to individual tiles instead of the zero-size tile pane. A filtered zero-size pane is a likely cause of clipping during browser compositing. A ResizeObserver and restored-tab hooks also keep Leaflet's map dimensions current; no continuous scroll handler was added.

## Verification

The user story is: page load -> published GET feeds -> corrected homepage rendering, with public sharing metadata in the initial HTML and radar tiles surviving scroll and container changes.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Data to copy | Passed | Date validation, distinct excerpt titles, preserved editorial titles, unordered RSS, scheduled items, undated items, and empty feeds covered by `test/homepage-copy.test.js`. |
| Existing regression suite | Passed | `npm test`: 420 tests passed, zero failed, zero skipped. Includes shared sky and existing homepage checks. |
| Published data to local homepage | Passed | Read-only local preview showed `Last Updated: Oct 11, 2026`, labeled FeelScore, distinct recent Pulse excerpts, and Latest Substack after a successful feed response. |
| Feed failure to fallback | Passed | Preview returned the API's upstream-failure shape (`link: null`, `fallback: true`). Card retained Featured Substack / Read featured update and its visible June publication date. |
| Responsive UI | Passed | Browser inspected at desktop and 390px mobile width; mobile FeelScore label fit and homepage had no horizontal overflow. |
| Radar | Passed in tested browser | Basemap visible on desktop, after repeated scroll-away/back, and at mobile size. Tile pane's computed filter was `none`; tiles retained the color filter. 48 loaded tiles were observed in the mobile inspection. |
| Static SEO | Passed | Exactly one description and canonical per navigation page; required social tags present, image paths exist, homepage JSON-LD parses, sitemap XML parses and contains 11 URLs. |
| Script syntax | Passed | Inline homepage and radar scripts passed Node syntax checks. |

Radar checks used the Codex in-app browser; they do not guarantee identical behavior on every browser/device. The exact intermittent production rendering cause remains a hypothesis, while the revised layout passed the tested interactions. The local preview proxies published read-only data and disables publishing. Its existing default data cache means preview readings can differ slightly from a new production request.

## Preview

Run `node tools/site-cleanup-preview.mjs` and open `http://127.0.0.1:4237/`. Open `http://127.0.0.1:4237/?substack=fallback` to check featured labeling when the feed is unavailable. The server accepts GET only, rejects admin pages, and does not read production credentials.

## Files changed in this cleanup

1. `public/index.html`
2. `public/forecast.html`
3. `public/radar.html`
4. `public/se_feelscore.html`
5. `public/water.html`
6. `public/i26-connector.html`
7. `public/pulse.html`
8. `public/fall.html`
9. `public/828-sunset-radiance.html`
10. `public/css/visual-intelligence.css`
11. `public/js/intel/homepage-copy.js` (new)
12. `lib/api-routes/substack-articles.js`
13. `lib/substack-feed.js` (new)
14. `public/robots.txt` (new)
15. `public/sitemap.xml` (new)
16. `test/homepage-copy.test.js` (new)
17. `tools/site-cleanup-preview.mjs` (new)
18. `docs/site-audit-cleanup.md` (new)

Analytics, push broadcasts, new cards, and a homepage media redesign were outside this focused pass. No commits, pushes, staged deployments, promotions, or platform-setting changes were made. Any later release remains subject to the repository's manual production gate.

## Follow-up: more natural comfort paragraph

The owner's browser comment requested a more human voice for `#liveFeelScoreSubhead`. The dry-weather paragraph now describes outdoor plans and conditions in shorter sentences, rather than listing four separate ingredient clauses. Short-term trends use plain phrases such as "it cools down a little" and "the breeze settles down." The paragraph leaves sky description to the neighboring sky read, avoiding a promise of sunshine during an evening forecast. Rain-focused narratives and stronger uncomfortable-weather guidance retain precedence; scoring is unchanged.

Verified in the refreshed local browser: "Tonight looks good for a walk or some time outside. Expect mild temperatures and a light breeze, without much humidity. Later tonight, it cools down a little and the breeze settles down."

Full suite after this follow-up: 423 tests passed, zero failures. Added coverage for evening language, warm/muggy evenings, and rain taking precedence over an otherwise comfortable score.

Follow-up files: `public/index.html`, `public/js/intel/human-action-feelscore.js`, `public/js/intel/synthesizer/assemble.js`, `public/js/intel/synthesizer/assembleWithVoice.js`, `test/human-action-feelscore.test.js`, and this document. These remain local and uncommitted.

## Follow-up: keep the fog experiment off the homepage

The owner clarified that Neighborhood fog potential is still experimental and not approved for a live release. Removed its mount point, stylesheet, and script from `public/index.html`. The fog modules, tests, and `tools/fog-preview.mjs` remain available for development. Added the release exclusion to `AGENTS.md` so a future cleanup release does not inadvertently enable it. Files changed for this correction: `public/index.html`, `AGENTS.md`, and this document. Nothing deployed.

## Follow-up: compact FeelScore card

Approved layout change: temperature checkpoints now share a compact three-column strip on desktop and mobile. Mobile shows the strip directly, without requiring expansion. The FeelScore card uses its content height instead of stretching the temperature rows to match the left panel. The left headline is smaller and omits the weak "with only a subtle ... dip" suffix; stronger deterioration or rain guidance is retained.

The existing sharp-temperature-change/seasonal callout keeps priority. Otherwise, a short takeaway uses the actual displayed current and future checkpoint temperatures, retaining explicit tomorrow timing. Missing temperatures produce no takeaway. In the inspected preview: "Heading out later? Expect around 63° by 10 PM, down 5° from now."

Browser checks: the first compact desktop inspection reduced FeelScore height from about 720px to 513px and the left panel from about 720px to 619px. Takeaway text was subsequently enlarged slightly for readability. At 390px mobile width, all three checkpoints had the same top position, the strip was visible without tapping, and page width remained 390px with no horizontal overflow. The fog card remained absent. The Comfort Curve remains in its existing section below.

Validation: 425 tests passed, zero failures. Forecast checkpoint selection, scoring, and existing high-priority temperature alerts are unchanged.

Files for this follow-up: `public/index.html`, `public/js/intel/temperature-takeaway.js` (new), `test/temperature-takeaway.test.js` (new), and this document. No commit, push, or deployment.

## Follow-up: symmetrical cards

The owner prefers equal card heights. Restored stretching of the outer FeelScore card while retaining compact, content-sized temperature rows and the shorter headline. Browser measurements at the desktop preview showed both cards at 528.6px wide and 619.36px high, sharing the same top edge. Files changed: `public/index.html` and this document. Nothing deployed.

## Follow-up: highlight North Downtown observations

Styled the existing station attribution as an inset callout with a gold left border, warm tinted background, brighter text, and a small "North Downtown · Local station" label. The underlying station summary and stale-data hiding behavior are unchanged. Text continues to be inserted with `textContent`; no station values are fabricated. Browser confirmed the label, 4px accent border, and matching main-card heights of 657.61px in the inspected view. All 13 relevant station/homepage tests passed. Files changed: `public/index.html` and this document. Nothing deployed.

## Follow-up: FeelScore explanation and outdoor window preview

At the owner's request, the FeelScore card now previews a compact best-upcoming-window inset using the model already returned by the full Comfort Curve. The time window names Today/Tomorrow explicitly, including windows crossing midnight and the daylight-saving transition. The score is clearly labeled Peak FeelScore, matching the curve's peak rather than implying that every hour has that score. The inset hides when the curve cannot supply a window. No independent scoring calculation was introduced.

Replaced generic, randomly selected ingredient bullets with a concise explanation from the same observed temperature, dew point, and wind inputs used by the detailed ingredients. Example: "Mild temperatures, manageable humidity, and very little wind are keeping it comfortable." Rain and UV notices retain a separate list when relevant; the explanation also acknowledges active rain. Missing data does not invent favorable weather. The full ingredient breakdown and Comfort Curve remain below.

Browser verification: best inset showed "Tomorrow, 9 AM–11 AM / Peak FeelScore 98 · Ideal" on desktop and mobile. Both desktop cards remained 657.61px tall. At 390px mobile width the page remained 390px wide, with the explanation, temperature strip, takeaway, and best window visible without horizontal scrolling. Full suite: 428 tests passed; the explanation wording's final refinement also passed all three targeted insight tests.

Files changed: `public/index.html`, `public/js/intel/feelscore-insight.js` (new), `test/feelscore-insight.test.js` (new), and this document. This is a local preview; no commits, pushes, or deployments.


## Production release approval

The owner explicitly approved production deployment on October 12, 2026. Release assembled on current origin/main (32f6d9f5), preserving newer Fall Explorer content and Southeast FEELSCORE asset versions. Includes approved homepage symmetry, station callout, FeelScore explanation and best window, natural narrative, audit metadata/copy/radar cleanup, and fog exclusion. Unrelated local experiments are excluded. Release validation: all 406 JavaScript tests and 10 MJS tests passed, npm run check and git diff --check passed. Stage and verify before approved manual promotion; retain autoAssignCustomDomains=false.
