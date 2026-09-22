/**
 * 아주 가벼운 정적 파일 로컬 서버 (외부 패키지 없이 Node 내장 http만 사용)
 * file:// 로 열면 fetch()가 막히기 때문에 반드시 이 서버로 실행해야 한다.
 *
 * 실행: node scripts/start-local.js
 * 환경변수 PORT로 포트를 바꿀 수 있다 (기본 5173).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScoringProfiles } from './build-scoring-profiles.js';
import { dailyKey } from '../src/js/quiz-session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 5173;
const GAME_PATHS = new Set(["/brandlogo", "/sports", "/contryflag", "/countryflag", "/animation", "/meme", "/pokemon"]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(root, normalized);
}

const server = http.createServer(async (req, res) => {
  const requestPath = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  const profile = requestPath.match(/^\/assets\/scoring\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/);
  if (profile) {
    try { await buildScoringProfiles(ROOT, profile[1], profile[2]); }
    catch { res.writeHead(503); res.end('Scoring data unavailable'); return; }
  }
  if (requestPath === '/api/rankings' && req.method === 'GET') {
    try {
      const category = new URL(req.url, 'http://localhost').searchParams.get('category') || '';
      if (process.env.LOCAL_RANKING_FIXTURES !== '0') {
        const fixtures = JSON.parse(await fs.promises.readFile(path.join(ROOT, 'src/data/ranking-fixtures.json'), 'utf8'));
        if (!Object.hasOwn(fixtures, category)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unknown category' }));
          return;
        }
        const now = Date.now();
        const midnight = Math.floor((now + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
        const rows = fixtures[category].map(({minutesAgo, ...row}) => ({...row, isTest: true, time: Math.max(midnight, now - minutesAgo * 60000)}));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ rows, day: dailyKey(), fixture: true }));
        return;
      }
      const response = await fetch(`https://colorsguesser.com/api/rankings?category=${encodeURIComponent(category)}`, { signal: AbortSignal.timeout(8000) });
      res.writeHead(response.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(await response.text());
    } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Ranking unavailable' })); }
    return;
  }
  if (requestPath.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use the online site to submit rankings' }));
    return;
  }
  const urlPath = req.url === "/" || GAME_PATHS.has(requestPath) ? "/index.html" : req.url;
  let filePath = safeJoin(ROOT, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      // "/problem-maker/" 처럼 폴더로 끝나는 요청은 그 폴더의 index.html을 대신 내려준다.
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (idxErr, idxStat) => {
        if (idxErr || !idxStat.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("404 Not Found: " + req.url);
          return;
        }
        sendFile(indexPath, res);
      });
      return;
    }

    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + req.url);
      return;
    }

    sendFile(filePath, res);
  });
});

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`Color Guesser 로컬 서버 실행 중: http://localhost:${PORT}`);
  console.log("종료하려면 Ctrl + C 를 누르세요.");
});
