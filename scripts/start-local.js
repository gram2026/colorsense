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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 5173;

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

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
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
