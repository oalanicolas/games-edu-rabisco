import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const moduleRoot=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(moduleRoot,'../../swipe/sael-educacao');
const manifest=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));
const catalog=JSON.parse(await readFile(path.resolve(moduleRoot,'../../output/edu-rabisco/sael-works-original.json'),'utf8'));
const annotations=new Map(JSON.parse(await readFile(path.join(moduleRoot,'src/edu-originals.json'),'utf8')).map(o=>[o.slug,Object.fromEntries(Object.entries(o).filter(([key])=>key.startsWith('classroom')))]));
const network={};const files=[];
for(const entry of manifest.files){
 const target=path.join(moduleRoot,'public/acervo',entry.local_path.replace(/^site\//,''));
 await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(source,entry.local_path),target);
 const data=await readFile(target);if(createHash('sha256').update(data).digest('hex')!==entry.sha256)throw new Error(`Hash divergente: ${entry.url}`);
 const local='/acervo/'+entry.local_path.replace(/^site\//,'');network[entry.url]=local;network[entry.final_url]=local;
 const url=new URL(entry.url);let alias='/acervo/'+url.host+url.pathname;
 if(alias.endsWith('/'))alias+='index.html';
 if(alias!==local&&path.extname(alias)){
  const dest=path.join(moduleRoot,'public',alias);await mkdir(path.dirname(dest),{recursive:true});await copyFile(target,dest);
 }
 files.push({url:entry.url,path:local,sha256:entry.sha256,bytes:entry.bytes,type:entry.content_type});
}
const canonicalWorks=new Map();
for(const work of catalog.works){
 const entry=manifest.files.find(f=>f.url.replace(/\/$/,'')===work.url.replace(/\/$/,''));
 const text=await readFile(path.join(source,entry.local_path),'utf8');
 const canonical=text.match(/<meta property=['"]og:url['"] content=['"]([^'"]+)/)?.[1]||entry.final_url;
 const url=new URL(canonical);canonicalWorks.set(url.origin+url.pathname.replace(/\/$/,''),work);
}
const aliases=[];
const originals=[];
for(const work of catalog.works){
 const entry=manifest.files.find(f=>f.url===work.url)||manifest.files.find(f=>f.url.replace(/\/$/,'')===work.url.replace(/\/$/,''));
 if(!entry)throw new Error(`Cliente original ausente: ${work.slug}`);
 const text=await readFile(path.join(source,entry.local_path),'utf8');
 const canonical=text.match(/<meta property=['"]og:url['"] content=['"]([^'"]+)/)?.[1]||entry.final_url;
 for(const anchor of text.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=anchor[1].match(/href=['"]([^'"]+)/)?.[1];if(!href)continue;
  const linked=new URL(href.replaceAll('&amp;','&'),entry.final_url),related=canonicalWorks.get(linked.origin+linked.pathname.replace(/\/$/,''))||catalog.works.find(work=>anchor[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').toLowerCase().includes(work.title.toLowerCase()));
  for(const match of anchor[2].matchAll(/data-(?:src|poster)=['"](also\/[^'"]+)['"]/g)){
   const originalUrl=new URL(match[1],canonical).href,extension=match[1].split('.').at(-1);
   const resource=network[originalUrl]?originalUrl:related?.also?.[extension];
   if(!resource||!network[resource])throw new Error(`Prévia original ausente: ${originalUrl}`);
   network[new URL(match[1],entry.final_url).href]=network[resource];
   network[new URL(match[1],entry.final_url.replace(/\/$/,'')+'/').href]=network[resource];
   aliases.push({page:entry.final_url,reference:match[1],original:originalUrl,archived:resource});
  }
 }

 originals.push({...work,...annotations.get(work.slug),source:entry.final_url,canonical,sourcePath:entry.local_path,sha256:entry.sha256,engine:work.slug==='sky'?'webgl':text.includes('__THREE_LIB')||text.includes('three-webgpu')||text.includes('three.module')||text.includes('THREE.WebGLRenderer')||work.slug==='dat-city'?'three':'verificar',posterLocal:network[work.poster],movieLocal:network[work.also?.mp4]});
}
await writeFile(path.join(moduleRoot,'public/acervo/manifest.json'),JSON.stringify({source:'https://sael.net/',captured:manifest.source.captured_at,files,failures:manifest.failures},null,2)+'\n');
await writeFile(path.join(moduleRoot,'public/acervo/aliases.json'),JSON.stringify(aliases,null,2)+'\n');
await writeFile(path.join(moduleRoot,'public/acervo/network.json'),JSON.stringify(network,null,2)+'\n');
await writeFile(path.join(moduleRoot,'public/original-routes.js'),`window.__EDU_NETWORK__=${JSON.stringify(network)};window.__EDU_PAGES__=${JSON.stringify(Object.fromEntries(originals.flatMap(o=>[[o.url.replace(/\/$/,''),`/originais/${o.slug}/`],[o.source.replace(/\/$/,''),`/originais/${o.slug}/`]])))};\n`);
await writeFile(path.join(moduleRoot,'src/edu-originals.json'),JSON.stringify(originals,null,2)+'\n');
console.log(JSON.stringify({projetos:originals.length,arquivos:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),scripts:files.filter(f=>f.type.includes('javascript')).length,engines:originals.reduce((r,o)=>(r[o.engine]=(r[o.engine]||0)+1,r),{})}));
