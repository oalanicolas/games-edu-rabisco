import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
async function list(path = '') {
  const entries = await readdir(new URL(path, root), { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? list(`${path}${e.name}/`) : [`${path}${e.name}`]));
  return nested.flat().filter(p => p !== 'sw.js' && !p.split('/').some(part => part.startsWith('.'))).sort();
}
const files = await list();
const hash = createHash('sha256');
hash.update('.htaccess');
hash.update(await readFile(new URL('.htaccess', root)));
for (const file of files) { hash.update(file); hash.update(await readFile(new URL(file, root))); }
const cache = `edu-rabisco-${hash.digest('hex').slice(0, 16)}`;
const paths = ['/', ...files.map(f => `/${f}`), ...files.filter(f=>f.endsWith('/index.html')&&f.startsWith('originais/')).map(f=>'/'+f.slice(0,-10))];
await writeFile(new URL('sw.js', root), `const CACHE=${JSON.stringify(cache)}; const FILES=${JSON.stringify(paths)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('edu-rabisco-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => { const url=new URL(event.request.url); if(event.request.method!=='GET'||url.origin!==self.location.origin)return; event.respondWith(caches.open(CACHE).then(async cache => { const hit=await cache.match(url.pathname); return hit||fetch(event.request); })); });
`);
console.log(`Offline: ${paths.length} recursos, ${cache}`);
