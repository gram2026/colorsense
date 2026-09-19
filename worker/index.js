import { onRequest } from '../functions/api/geo.js';
import { ranking } from './ranking.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rankings') {
      try { return await ranking(request, env); }
      catch (err) { console.error('Ranking API failed', err); return Response.json({ error: 'Ranking unavailable' }, { status: 503 }); }
    }
    if (url.pathname === '/api/geo') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      const response = onRequest({ request });
      response.headers.set('Cache-Control', 'no-store');
      return request.method === 'HEAD' ? new Response(null, response) : response;
    }
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
