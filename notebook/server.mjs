import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5174);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname === '/') { res.writeHead(302,{Location:'/problem-maker/'}); res.end(); return; }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.resolve(root,relative);
    if(!file.startsWith(root + path.sep) || !['problem-maker','src','vendor','assets'].includes(relative.split('/')[0])) {
      res.writeHead(403); res.end(); return;
    }
    if((await fs.promises.stat(file)).isDirectory()) file = path.join(file,'index.html');
    const data = await fs.promises.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error',err => { console.error(err.code === 'EADDRINUSE' ? 'Port 5174 is already in use. Close the other maker window/server first.' : err); process.exitCode=1; });
server.listen(port,'127.0.0.1',() => {
  const url = `http://127.0.0.1:${port}/problem-maker/`;
  console.log(`Notebook quiz maker: ${url}\nKeep this window open. Ctrl+C to stop.`);
  if(!process.env.NO_BROWSER) execFile('cmd.exe',['/c','start','',url],{windowsHide:true});
});
