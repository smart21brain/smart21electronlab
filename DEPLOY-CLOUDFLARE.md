# Deploy on Cloudflare Workers (with Workers AI)

1. `npm install`
2. `npx wrangler login`
3. `npm run cf:deploy`   (regenerates sw.js, then deploys `worker/index.js` + the `src/` folder)

Local test: `npm run cf:dev`

- Workers AI is bound as `AI` in `wrangler.jsonc`. No API key is needed.
- The app calls `POST /api/ai`; the Worker streams the answer back.
- Change the default model with `AI_MODEL` in `wrangler.jsonc` (allowed list is in `worker/index.js`).
- If you deploy from GitHub (Workers Builds), set the build command to `npm run pwa` and the deploy command to `npx wrangler deploy`.
