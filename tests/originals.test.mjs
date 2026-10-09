import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import originals from '../src/edu-originals.json' with {type:'json'};
import {originalLessons,ownLessons} from '../src/edu-catalog.js';
const root=new URL('../public/',import.meta.url);
test('rejeição de maquetes simplificadas: catálogo principal inteiro aponta aos 57 clientes originais',()=>{
 assert.equal(originals.length,57);assert.equal(originalLessons.length,57);assert.equal(ownLessons.length,20);
 assert.equal(new Set(originalLessons.map(l=>l.originalSlug)).size,57);
 for(const source of originals){const l=originalLessons.find(l=>l.originalSlug===source.slug);assert.ok(l);assert.equal(l.href,`/originais/${source.slug}/`);assert.equal(l.sourceName,'Ryan Sael');}
});
test('todos os bytes públicos capturados estão preservados por hash, incluindo todos os arquivos JavaScript',async()=>{
 const manifest=JSON.parse(await readFile(new URL('acervo/manifest.json',root),'utf8'));
 assert.ok(manifest.files.length>600);
 for(const f of manifest.files){const data=await readFile(new URL(f.path.slice(1),root));assert.equal(data.length,f.bytes,f.url);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,f.url);}
 assert.ok(manifest.files.filter(f=>f.type.includes('javascript')).length>=91);
});
test('todos os scripts internos do cliente original são reutilizados inteiros; Sky altera somente a criação do renderizador',async()=>{
 for(const source of originals){
  const raw=await readFile(new URL(source.sourcePath.replace(/^site\//,'acervo/'),root),'utf8');
  const page=await readFile(new URL(`originais/${source.slug}/index.html`,root),'utf8');
  const inline=[...raw.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('src=')&&!m[1].includes('importmap'));
  for(const script of inline){let content=script[2];if(source.slug==='sky')content=content.replace('gl=canvas.getContext("webgl",{alpha:!1,antialias:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"})','gl=window.__EDU_SKY_GL__(canvas)');assert.ok(page.includes(content),`Script original alterado em ${source.slug}`);}
  assert.ok(page.includes('/original-notebook.js'));assert.ok(!page.includes('edu-port-scenes.js'));
 }
});
