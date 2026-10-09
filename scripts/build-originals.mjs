import {readFile,writeFile,mkdir} from 'node:fs/promises';
import originals from '../src/edu-originals.json' with {type:'json'};
import {lessons} from '../src/edu-catalog.js';
const root=new URL('../public/',import.meta.url);
const network=JSON.parse(await readFile(new URL('acervo/network.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('acervo/manifest.json',root),'utf8'));
const styles=new Map(manifest.files.filter(f=>f.type.includes('css')).map(f=>[f.url,`/originais/estilos/${f.sha256}.css`]));
const nativeImports=Object.fromEntries(manifest.files.filter(f=>f.type.includes('javascript')).map(f=>[f.url,f.path]));
const originalByUrl=new Map(originals.map(o=>[o.url.replace(/\/$/,''),o]));
const map=(value,base)=>{
 if(!value||value.includes('${')||value.startsWith('#')||value.startsWith('data:')||value.startsWith('blob:'))return value;
 try{
  const u=new URL(value,base);const o=originalByUrl.get(u.origin+u.pathname.replace(/\/$/,''));
  if(o)return `/originais/${o.slug}/${u.search}${u.hash}`;
  if(styles.has(u.href))return styles.get(u.href)+u.hash;
  const exact=network[u.href.replace(/#.*$/,'')];if(exact)return exact+u.hash;
  if(Object.values(network).some(p=>p.startsWith(`/acervo/${u.host}/`)))return `/acervo/${u.host}${u.pathname}${u.search}${u.hash}`;
 }catch{}
 return value;
};
const css=(text,base)=>text.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g,(match,quote,value)=>`url(${quote}${map(value.trim(),base)}${quote})`).replace(/@import\s*(['"])([^'"]+)\1/g,(match,quote,value)=>`@import ${quote}${map(value,base)}${quote}`);
await mkdir(new URL('originais/estilos/',root),{recursive:true});
for(const file of manifest.files.filter(f=>f.type.includes('css'))){
 const raw=await readFile(new URL(file.path.slice(1),root),'utf8');
 await writeFile(new URL(styles.get(file.url).slice(1),root),css(raw,file.url));
}
const routedNetwork={...network,...Object.fromEntries(styles)};
await writeFile(new URL('original-routes.js',root),`window.__EDU_NETWORK__=${JSON.stringify(routedNetwork)};window.__EDU_PAGES__=${JSON.stringify(Object.fromEntries(originals.flatMap(o=>[[o.url.replace(/\/$/,''),`/originais/${o.slug}/`],[o.source.replace(/\/$/,''),`/originais/${o.slug}/`]])))};\n`);
const pages=[];
for(const o of originals){
 const raw=await readFile(new URL(o.sourcePath.replace(/^site\//,'acervo/'),root),'utf8');
 const lesson=lessons.find(l=>l.originalSlug===o.slug)||lessons.find(l=>l.source?.replace(/\/$/,'')===o.url.replace(/\/$/,''));
 const metadata={slug:o.slug,source:o.source,title:o.classroomTitle||lesson?.title||o.title,summary:o.classroomSummary||lesson?.summary||'',question:o.classroomQuestion||lesson?.question||'O que muda quando você altera uma condição?',explanation:o.classroomExplanation||lesson?.explanation||'Use a explicação e a ajuda presentes na experiência original para interpretar o que a cena representa. Identifique o que é dado observado, o que é modelo e o que é recurso visual.',challenge:o.classroomChallenge||'Escolha um controle da experiência original. Registre uma configuração, altere somente esse controle e registre outra. Compare as leituras e a imagem, e explique a diferença.',limit:'Esta versão executa o cliente publicado por Ryan Sael. Consulte também os limites descritos na explicação original. Dados externos preservados correspondem à captura, não são uma leitura ao vivo.',published:o.date,captured:'2026-10-09',sourceEngine:o.engine,renderAdaptation:o.slug==='sky'?'Shaders originais executados por RawShaderMaterial Three.js':'nenhuma',captureDate:'2026-10-09',engine:'three',sourceHash:o.sha256};
 const base=`/acervo/${new URL(o.source).host}${new URL(o.source).pathname.replace(/[^/]*$/,'')}`;
 const scripts=[];let hasImportMap=false;
 const attributes=text=>text.replace(/\b(src|href|poster|srcset|imagesrcset)=(['"])([^'"<>]+)\2/g,(match,name,quote,value)=>{value=value.replaceAll('&amp;','&');const mapped=name.endsWith('srcset')?value.split(',').map(item=>{const [url,...size]=item.trim().split(/\s+/);return [map(url,o.source),...size].join(' ');}).join(','):map(value,o.source);return `${name}=${quote}${mapped}${quote}`;});
 let html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,script=>{
  const tag=script.slice(0,script.indexOf('>')+1);
  if(/\bsrc=/.test(tag)&&/dat\.d1\.tel|a\.d1\.tel|cloudflareinsights|googletagmanager/.test(tag))return '';
  let adapted=attributes(tag)+script.slice(tag.length);
  if(/type=['"]importmap['"]/.test(tag)){
   hasImportMap=true;
   const data=JSON.parse(script.slice(tag.length,script.lastIndexOf('</script>')));
   for(const key of Object.keys(data.imports||{}))data.imports[key]=map(data.imports[key],o.source);
   data.imports={...nativeImports,...data.imports};
   adapted=tag+JSON.stringify(data)+'</script>';
  }
  if(o.slug==='sky'&&script.includes('gl=canvas.getContext("webgl"'))adapted=adapted.replace('gl=canvas.getContext("webgl",{alpha:!1,antialias:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"})','gl=window.__EDU_SKY_GL__(canvas)');
  scripts.push(adapted);return `<!--EDU_SCRIPT_${scripts.length-1}-->`;
 });
 html=attributes(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,style=>css(style,o.source)).replace(/<!--EDU_SCRIPT_(\d+)-->/g,(match,n)=>scripts[Number(n)]);
 html=html.replace(/(<head[^>]*>)/i,`$1<base href="${base}"><script>window.__EDU_SOURCE__=${JSON.stringify(metadata).replaceAll('<','\\u003c')};</script><script src="/original-routes.js"></script><script src="/original-bridge.js"></script><link rel="stylesheet" href="/original-notebook.css">`);
 if(!hasImportMap)html=html.replace('</head>',`<script type="importmap">${JSON.stringify({imports:nativeImports})}</script></head>`);
 if(o.slug==='sky')html=html.replace('</head>','<script src="/acervo/sael.net/lib/three-0.183.2.js"></script><script src="/original-sky-three.js"></script></head>');
 html=html.replace(/(<\/body>)/i,'<script src="/original-notebook.js" defer></script><script src="/stats.js" defer></script>$1');
 const folder=new URL(`originais/${o.slug}/`,root);await mkdir(folder,{recursive:true});await writeFile(new URL('index.html',folder),html);
 pages.push({slug:o.slug,url:`/originais/${o.slug}/`,sourceHash:o.sha256,engine:'three',sourceEngine:o.engine});
}
await writeFile(new URL('originais/pages.json',root),JSON.stringify(pages,null,2)+'\n');
console.log(JSON.stringify({paginas:pages.length,source:'https://sael.net/',adaptacao:'Somente caminhos locais, integração do caderno e retirada da telemetria externa; cenas e modelos originais.'}));
