/* Smart21 ElectroLab — Cloudflare Worker
   * Serves the app (static files from ../src through the ASSETS binding).
   * POST /api/ai  → Workers AI (env.AI), streamed back as Server-Sent Events.
   Smart model routing:  "auto" = expert model for design / debug / troubleshoot / code / long
   context, fast model for simple questions. If the expert model fails (quota, outage) the
   request is retried on the fast model. No API key is needed: the AI binding is in wrangler.jsonc.
   Optional protection (all off by default):
     vars.EXTRA_MODELS = "@cf/vendor/model-a,@cf/vendor/model-b"  → add more Workers AI models without editing code
     vars.ALLOWED_ORIGINS = "https://my-site.com,https://other.com"  → only these sites may call /api/ai
     a Rate Limiting binding named RATE_LIMITER                       → per-IP limit (see DEPLOY-CLOUDFLARE.md) */

const FAST = '@cf/meta/llama-3.1-8b-instruct';
const EXPERT = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const ALLOWED_MODELS = new Set([
  FAST, EXPERT,
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct'
]);
const allowedModels = env => new Set([...ALLOWED_MODELS, ...String((env && env.EXTRA_MODELS) || '').split(',').map(x => x.trim()).filter(x => /^@cf\/[\w.\-\/]+$/.test(x))]);
const HARD_MODES = new Set(['design', 'debug', 'trouble', 'code', 'calc']);
const MAX_MESSAGES = 20, MAX_CHARS = 24000, MAX_SYSTEM = 12000, MAX_BODY = 250000, MAX_TOKENS = 2500;

const corsFor = (origin) => ({
  'access-control-allow-origin': origin || '*', 'vary': 'Origin',
  'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400'
});
const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status: status || 200, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function originAllowed(request, env, url) {
  const origin = request.headers.get('Origin'); if (!origin || origin === url.origin) return true;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
  return !list.length || list.includes(origin);
}

function pickModel(req, env, totalChars) {
  const asked = String(req.model || '').trim();
  const allow = allowedModels(env);
  if (allow.has(asked)) return asked;
  if (/^fast$/i.test(asked)) return FAST;
  if (/^expert$/i.test(asked)) return EXPERT;
  const dflt = String(env.AI_MODEL || '').trim();
  if (allow.has(dflt) && dflt !== FAST) return dflt;      // owner pinned a model in wrangler.jsonc
  return HARD_MODES.has(String(req.mode || '')) || req.ctx === true || totalChars > 3500 ? EXPERT : FAST;
}

async function handleAI(request, env, cors) {
  if (!env.AI) return json({ error: 'Workers AI binding "AI" is missing. Add it in wrangler.jsonc or Dashboard → Worker → Settings → Bindings → Workers AI (name: AI).' }, 500, cors);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ error: 'Request too large.' }, 413, cors);
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    try { const ip = request.headers.get('cf-connecting-ip') || 'anon'; const r = await env.RATE_LIMITER.limit({ key: ip }); if (!r.success) return json({ error: 'Too many questions, wait a minute and try again.' }, 429, cors); } catch (_) {}
  }
  let req; try { req = await request.json(); } catch (_) { return json({ error: 'Invalid JSON.' }, 400, cors); }

  const messages = (Array.isArray(req.messages) ? req.messages : []).slice(-MAX_MESSAGES)
    .map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, MAX_CHARS) }))
    .filter(m => m.content);
  if (!messages.length) return json({ error: 'Nothing to send.' }, 400, cors);
  const system = String(req.system || '').slice(0, MAX_SYSTEM);
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  const model = pickModel(req, env, total);
  const payload = { messages: system ? [{ role: 'system', content: system }, ...messages] : messages, stream: true, max_tokens: MAX_TOKENS, temperature: 0.3 };

  const sse = (stream, used) => new Response(stream, { headers: { ...cors, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', 'x-ai-model': used } });
  try {
    return sse(await env.AI.run(model, payload), model);
  } catch (e) {
    if (model !== FAST) {
      try { return sse(await env.AI.run(FAST, payload), FAST); } catch (e2) { e = e2; }
    }
    return json({ error: (e && e.message) || 'Workers AI error.' }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai') {
      const origin = request.headers.get('Origin'), cors = corsFor(origin);
      if (!originAllowed(request, env, url)) return json({ error: 'This website is not allowed to use this Worker.' }, 403, corsFor(null));
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method === 'GET') return json({ ok: true, ai: !!env.AI, fast: FAST, expert: EXPERT, models: [...allowedModels(env)] }, 200, cors);
      if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);
      return handleAI(request, env, cors);
    }
    return withHeaders(await env.ASSETS.fetch(request), url);
  }
};

/* Security + caching headers for the website files (good for SEO speed scores and safety). */
function withHeaders(res, url) {
  const r = new Response(res.body, res), h = r.headers, path = url.pathname;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Strict-Transport-Security', 'max-age=31536000');
  if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(path)) h.set('Cache-Control', 'public, max-age=2592000');
  else if (/\.(js|css)$/i.test(path)) h.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  else if (/\/(robots\.txt|sitemap\.xml)$/.test(path)) h.set('Cache-Control', 'public, max-age=86400');
  else if (path === '/sw.js' || path.endsWith('.html') || path === '/') h.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return r;
}
