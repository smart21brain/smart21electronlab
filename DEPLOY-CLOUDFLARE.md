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
5. Old version stuck? Hard refresh (Ctrl+Shift+R) or clear site data once; version 1.8.1 refreshes the cache automatically.
