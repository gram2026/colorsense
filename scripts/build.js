import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'src', 'assets', 'problem-maker']) {
  await cp(path.join(root, entry), path.join(output, entry), {
    recursive: true,
    filter: source => !/\.(?:md|bak)$/i.test(source) && !/\.bak-.*\.json$/i.test(source),
  });
}
await mkdir(path.join(output, 'vendor'), { recursive: true });
await cp(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), path.join(output, 'vendor/jszip.min.js'));
await cp(path.join(root, 'node_modules/jszip/LICENSE.markdown'), path.join(output, 'vendor/JSZip-LICENSE.txt'));
await cp(path.join(root, '_headers'), path.join(output, '_headers'));
await writeFile(path.join(output, '_routes.json'), JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }, null, 2) + '\n');
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>404</title><h1>페이지를 찾을 수 없습니다</h1><a href="/">게임으로 돌아가기</a></html>');
await writeFile(path.join(output, '.assetsignore'), '_routes.json\n');
console.log('Cloudflare 배포 파일 생성 완료: dist/');
