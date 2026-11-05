/* Smart21 ElectroLab — Cloudflare Worker
   * Serves the app (static files from ../src through the ASSETS binding).
   * POST /api/ai  → Workers AI (env.AI), streamed back as Server-Sent Events.
   No API key is needed: the AI binding is configured in wrangler.jsonc. */

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct'
]);
const MAX_MESSAGES = 20, MAX_CHARS = 24000, MAX_SYSTEM = 6000, MAX_BODY = 200000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function handleAI(request, env) {
  if (!env.AI) return json({ error: 'Workers AI binding "AI" is missing. Check wrangler.jsonc.' }, 500);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ error: 'Request too large.' }, 413);
  let req; try { req = await request.json(); } catch (_) { return json({ error: 'Invalid JSON.' }, 400); }

  const messages = (Array.isArray(req.messages) ? req.messages : []).slice(-MAX_MESSAGES)
    .map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, MAX_CHARS) }))
    .filter(m => m.content);
  if (!messages.length) return json({ error: 'Nothing to send.' }, 400);
  const system = String(req.system || '').slice(0, MAX_SYSTEM);
  const model = ALLOWED_MODELS.has(req.model) ? req.model : (env.AI_MODEL && ALLOWED_MODELS.has(env.AI_MODEL) ? env.AI_MODEL : DEFAULT_MODEL);

  try {
    const stream = await env.AI.run(model, {
      messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
      stream: true,
      max_tokens: 1800
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
  } catch (e) {
    return json({ error: (e && e.message) || 'Workers AI error.' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai') {
      if (request.method === 'GET') return json({ ok: true, models: [...ALLOWED_MODELS], default: DEFAULT_MODEL });
      if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
      return handleAI(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
