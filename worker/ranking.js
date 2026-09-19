import { validateNickname } from '../src/js/nickname.js';
import { dailyKey, pickFive } from '../src/js/quiz-session.js';
import { calculateScore } from '../src/js/color/scoring.js';
import { appliedColorHex, resolveRenderMode } from '../src/js/color/mask-renderer.js';

export async function ranking(request, env) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!env.RANKING_DB) return reply({ error: 'Ranking database is not configured' }, 503);
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('category');
  const json = async path => {
    const response = await env.ASSETS.fetch(new Request(new URL('/' + path, url)));
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  };
  const categories = (await json('src/data/categories.json')).categories.filter(c => c.enabled && !c.comingSoon);
  const category = categories.find(c => c.id === categoryId);
  if (!category) return reply({ error: 'Unknown category' }, 400);
  const day = dailyKey();
  if (request.method === 'GET') {
    const { results } = await env.RANKING_DB.prepare('SELECT name, score, time FROM rankings WHERE category = ? AND day = ? ORDER BY score DESC, time ASC LIMIT 100').bind(categoryId, day).all();
    return reply({ rows: results.filter(r => validateNickname(r.name).ok), day });
  }
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return reply({ error: 'Invalid origin' }, 403);
  const raw = await request.text();
  if (raw.length > 12000) return reply({ error: 'Request too large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  const nickname = validateNickname(body.name);
  if (!nickname.ok) return reply({ error: 'Invalid nickname' }, 400);
  if (!/^[a-f0-9-]{36}$/i.test(body.runId || '') || !Array.isArray(body.rounds) || body.rounds.length !== 5) return reply({ error: 'Complete five rounds first' }, 400);
  if (categoryId === 'daily' && body.day !== day) return reply({ error: 'Daily quiz expired' }, 400);
  const sources = category.isRandomMix ? categories.filter(c => !c.isRandomMix && c.questionFile) : [category];
  let pool = (await Promise.all(sources.map(async c => (await json(c.questionFile)).questions.filter(q => q.enabled !== false).map(q => ({ ...q, categoryId: c.id }))))).flat();
  if (categoryId === 'daily') pool = pickFive(pool, day);
  const config = await json('src/data/config.json');
  const used = new Set();
  let total = 0;
  for (const round of body.rounds) {
    const q = pool.find(q => q.id === round.id && q.categoryId === round.categoryId);
    const id = `${round.categoryId}/${round.id}`;
    if (!q || used.has(id) || !/^#[0-9a-f]{6}$/i.test(round.color)) return reply({ error: 'Invalid rounds' }, 400);
    used.add(id);
    const applied = resolveRenderMode(q.renderMode) === 'preserve-lightness' ? appliedColorHex(round.color, q.answerColor) : round.color;
    total += calculateScore(applied, q.answerColor, config.scoring).score;
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ip}`));
  const client = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const score = Math.round(total / 5 * 10) / 10;
  const result = await env.RANKING_DB.prepare(`INSERT OR IGNORE INTO rankings (run_id, category, day, name, score, time, client)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM rankings WHERE client = ? AND time > ?) < 10`)
    .bind(body.runId, categoryId, day, nickname.name, score, Date.now(), client, client, Date.now() - 60000).run();
  if (!result.meta.changes) return reply({ error: 'Already submitted or rate limited' }, 409);
  return reply({ ok: true, score });
}
