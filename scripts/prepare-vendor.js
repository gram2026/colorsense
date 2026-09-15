import { mkdir, copyFile } from 'node:fs/promises';
const vendor = new URL('../vendor/', import.meta.url);
await mkdir(vendor, { recursive: true });
await copyFile(new URL('../node_modules/jszip/dist/jszip.min.js', import.meta.url), new URL('jszip.min.js', vendor));
