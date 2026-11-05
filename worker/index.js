// Smart21 ElectroLab: Cloudflare Worker. Static files are served from ./src by the assets binding;
// this script only runs for /api/* (see run_worker_first in wrangler.jsonc).

// Edit this list to change which Workers AI models the tutor may use (see developers.cloudflare.com/workers-ai/models).
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
const DEFAULT_MODEL = MODELS[0];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Returns a Response for /api/ai and /api/ai/health, or null for any other path so your own routes can handle it.
export async function handleAi(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ai/health' && request.method === 'GET') {
      return json({ ok: !!env.AI, models: MODELS, defaultModel: DEFAULT_MODEL });
    }

    if (url.pathname === '/api/ai' && request.method === 'POST') {
      if (!env.AI) return json({ error: 'Workers AI is not bound to this Worker.' }, 503);
      // same-origin only, so other sites cannot spend your Workers AI quota
      const origin = request.headers.get('Origin');
      if (origin) { try { if (new URL(origin).host !== url.host) return json({ error: 'Forbidden' }, 403); } catch (_) { return json({ error: 'Forbidden' }, 403); } }

      const raw = await request.text();
      if (raw.length > 200000) return json({ error: 'Request too large.' }, 413);
      let body; try { body = JSON.parse(raw); } catch (_) { return json({ error: 'Bad JSON.' }, 400); }

      const model = MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
      const history = (Array.isArray(body.messages) ? body.messages : []).slice(-20).map(m => ({
        role: m && m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m && m.content || '').slice(0, 12000)
      }));
      if (!history.length) return json({ error: 'Nothing to send.' }, 400);
      const messages = [{ role: 'system', content: String(body.system || '').slice(0, 6000) }, ...history];

      try {
        const stream = await env.AI.run(model, { messages, stream: true, max_tokens: 1500 });
        return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
      } catch (e) {
        return json({ error: 'Workers AI error: ' + (e && e.message || e) }, 502);
      }
    }

    return null;
}

export default {
  async fetch(request, env) {
    return (await handleAi(request, env)) || json({ error: 'Not found' }, 404);
  }
};
