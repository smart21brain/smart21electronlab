# Deploy on Cloudflare Workers (with Workers AI)

1. `npm install`
2. `npx wrangler login`
3. `npm run cf:deploy`   (regenerates sw.js, then deploys `worker/index.js` + the `src/` folder)

Local test: `npm run cf:dev`

- Workers AI is bound as `AI` in `wrangler.jsonc`. No API key is needed.
- The app calls `POST /api/ai`; the Worker streams the answer back.
- Change the default model with `AI_MODEL` in `wrangler.jsonc` (allowed list is in `worker/index.js`).
- If you deploy from GitHub (Workers Builds), set the build command to `npm run pwa` and the deploy command to `npx wrangler deploy`.

## If the AI does not answer
1. Open `https://YOUR-SITE/api/ai` in a browser. You must see JSON like `{"ok":true,"models":[...]}`. If you see a 404 or your normal page, the Worker is not serving that site (see below).
2. Cloudflare dashboard → your Worker → Settings → Bindings: there must be a **Workers AI** binding named exactly `AI`.
3. The site must be served by this Worker (Workers → your Worker → Domains & Routes). A plain Cloudflare **Pages** project does not run `worker/index.js`.
4. If the Worker lives on a different address than the site, open the app → Settings → AI tutor engine → Worker URL and paste e.g. `https://smart21electronlab.NAME.workers.dev`.
5. Old version stuck? Hard refresh (Ctrl+Shift+R) or clear site data once; every new version number refreshes the cache automatically.

## AI features
- **Model "auto"** (default): fast model for simple questions, the expert 70B model for Design, Debug, Troubleshoot, Arduino code, Calculate, or when your circuit is attached. If the expert model fails or the daily free allowance is used up, the Worker retries on the fast model. In Settings you can type `fast`, `expert` or any model from `worker/index.js`.
- **Exact numbers:** the built-in calculators run first and their results are given to the AI as verified facts.
- **Circuit doctor:** real problems found in your circuit (reversed LED, short circuit, missing ground...) are sent to the AI so it explains the real faults.
- **New modes:** Design, Troubleshoot, Arduino code. Follow-up question buttons appear under each answer.
- **Protect your quota:** in `wrangler.jsonc` set `"ALLOWED_ORIGINS": "https://your-site.com"`. Optional per-IP limit: add a Rate Limiting binding named `RATE_LIMITER` (Dashboard → Worker → Settings → Bindings, or see the Cloudflare "Rate Limiting" docs).

## Security policy (CSP) — why "Failed to fetch" happened
`src/index.html` contains a Content-Security-Policy. Older versions had `connect-src 'none'`, which blocks every network request, including `/api/ai`. It is now `connect-src 'self' https://*.workers.dev`:
- the Worker serving your own website (same address) works;
- a Worker on `*.workers.dev` works;
- a Worker on a DIFFERENT custom domain needs that domain added to `connect-src` in `src/index.html` (then run `npm run cf:deploy`).
After deploying, reload the page twice (or Ctrl+Shift+R) so the browser replaces its cached copy of the old page.

## SEO
Site address used everywhere: `https://smart21electronlab.smart21brain.com`. If your domain changes, search-and-replace it in `src/index.html`, `src/robots.txt` and `src/sitemap.xml`, then redeploy.
After deploying:
1. Google Search Console → add the site → Sitemaps → submit `sitemap.xml`; use "URL inspection → Request indexing" for the home page.
2. Bing Webmaster Tools → import from Search Console.
3. Test sharing: paste the link in WhatsApp/Facebook/X (the preview card shows `img/og-1200x630.png`).
4. Check speed at pagespeed.web.dev. The Worker already adds caching + security headers.
Ranking also needs real links to your site: link to it from smart21brain.com, your social profiles and YouTube videos.

## Desktop app (.exe) with Smart21 AI
- The Windows/macOS/Linux app now uses **Workers AI as the default engine**. When the computer is online, questions go to Smart21 AI (`https://smart21electronlab.smart21brain.com/api/ai`); when there is no internet (or the service is down) the built-in offline tutor answers by itself, with a short "📴" note. When the internet is back, Smart21 AI is used again automatically. The label above the chat shows which one is active.
- Someone who had already pressed Save with "Built-in offline tutor" keeps that choice: Settings → Engine → Workers AI → Save.
- Own Worker address: Settings → Worker URL (leave empty for the default). "Test connection" works in the desktop app too.
- Build the .exe:
  - on Windows: `npm install` then `npm run dist:win` (installer appears in `dist/`);
  - or online: push a tag like `v1.0.0` (or Actions → Build installers → Run workflow) and download the artifacts.
