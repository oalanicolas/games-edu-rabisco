import {chromium} from '../../../libraries/metal-assault/lab/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import originals from '../src/edu-originals.json' with {type:'json'};
const hub=fileURLToPath(new URL('../../../',import.meta.url));
let base=process.env.EDU_QA_URL||JSON.parse(execFileSync('python3',['framework/scripts/game.py','serve','apps/edu-rabisco','--json'],{cwd:hub,encoding:'utf8'})).url;
if(new URL(base).hostname==='localhost'){const local=new URL(base);local.hostname='edu-qa.test';base=local.href;}
const destination=new URL('../../../output/edu-rabisco/qa-originals/',import.meta.url);await mkdir(destination,{recursive:true});
const resumed=process.env.EDU_QA_RESUME==='1'?JSON.parse(await readFile(new URL('report.json',destination),'utf8')).rows:[];
const browser=await chromium.launch({channel:'chrome',headless:process.env.QA_HEADED!=='1',args:['--use-angle=metal','--ignore-gpu-blocklist','--host-resolver-rules=MAP edu-qa.test 127.0.0.1']});
const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
const page=await context.newPage(),rows=resumed.filter(r=>r.desktop&&r.mobile&&!r.errors.length&&!r.missing.length&&!r.failure),checks=[],missing=new Set();let row;
page.on('pageerror',e=>row?.errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400||(r.status()>=200&&r.status()<300&&r.request().resourceType()==='stylesheet'&&!r.headers()['content-type']?.includes('css'))){const u=new URL(r.url());if(u.origin===new URL(base).origin){row?.missing.push({url:r.url(),status:r.status()});missing.add(r.url());}else row?.external.push({url:r.url(),status:r.status()});}});
const ready=async()=>{await page.waitForFunction(()=>window.__EDU_ORIGINAL__?.ready,{timeout:60000});await page.waitForTimeout(1500);assert.ok(await page.locator('canvas').count());};
const shot=async name=>{await page.waitForTimeout(800);return page.screenshot({path:fileURLToPath(new URL(`${name}.png`,destination))});};
try{
 for(const original of process.env.EDU_QA_CONTROLS_ONLY==='1'?[]:originals.filter(o=>!rows.some(r=>r.slug===o.slug))){
  row={slug:original.slug,errors:[],missing:[],external:[],states:[],desktop:false,mobile:false};rows.push(row);
  try{
   await page.setViewportSize({width:1440,height:1050});await page.goto(new URL(`/originais/${original.slug}/`,base).href,{waitUntil:'domcontentloaded'});await ready();
   row.initial=await page.evaluate(()=>({state:window.__EDU_ORIGINAL__.observe(),canvases:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),controls:document.querySelectorAll('button,input,select').length,gpu:(()=>{const c=[...document.querySelectorAll('canvas')].find(c=>c.getContext('webgl2')||c.getContext('webgl'));if(!c)return 'WebGPU or unavailable';const gl=c.getContext('webgl2')||c.getContext('webgl'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})()}));
   assert.equal(row.initial.state.sourceHash,original.sha256);assert.equal(row.initial.state.engine,'three');assert.ok(row.initial.canvases.some(c=>c.width>0&&c.height>0));assert.doesNotMatch(row.initial.gpu,/SwiftShader|llvmpipe/);
   for(const name of ['Lab','Exploded','Studio','Pause','Play']){const button=page.getByRole('button',{name,exact:true}).first();if(await button.isVisible().catch(()=>false)){await button.click();await page.waitForTimeout(120);row.states.push(name);}}
   if(original.slug==='dat-city'){
    await page.waitForFunction(()=>{const entries=[...window.__datCity.manager.entries.values()].filter(e=>e.kind==='district'&&!e.district.synthetic);return entries.length>0&&entries.every(e=>e.data?.contentKind==='dat-city.district');},{},{timeout:120000});
    row.districts=await page.evaluate(()=>[...window.__datCity.manager.entries.values()].filter(e=>e.kind==='district'&&!e.district.synthetic).map(e=>({id:e.district.id,contentKind:e.data.contentKind,entities:e.data.entities.length,url:e.district.dataUrl})));
    const manifest=await page.evaluate(async()=>{const live=await (await fetch('https://story-data.dat.city/story-data/manifest.json')).json();return (await fetch('https://story-data.dat.city/story-data/'+live.latest.cityManifestUrl)).json();});
    const configured=await page.evaluate(()=>JSON.parse(document.getElementById('city-config').textContent).districts.filter(d=>!d.synthetic).map(d=>d.id));assert.deepEqual(row.districts.map(d=>d.id).sort(),configured.sort());for(const district of manifest.districts)assert.ok(row.districts.some(d=>d.id===district.id));
    await page.waitForFunction(()=>window.__datCity.manager.isSettled,{},{timeout:120000});row.states.push('todos os bairros originais carregados sem dados sintéticos');
    await page.evaluate(()=>window.__datCity.overview());await page.waitForTimeout(1700);
   }
   await shot(`desktop-${original.slug}`);
   await page.evaluate(()=>{window.__EDU_NOTEBOOK__.open(true);window.__EDU_NOTEBOOK__.panel('investigar');});await page.locator('#edu-clear').click();await page.locator('#edu-record').click();await page.locator('#edu-record').click();assert.equal(await page.locator('.edu-record').count(),2);assert.equal((await page.evaluate(()=>window.__EDU_NOTEBOOK__.records()))[0].sourceHash,original.sha256);
   await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal((await page.evaluate(()=>window.__EDU_NOTEBOOK__.records())).length,2);
   row.desktop=true;await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await ready();if(original.slug==='dat-city'){await page.waitForFunction(()=>[...window.__datCity.manager.entries.values()].filter(e=>e.kind==='district'&&!e.district.synthetic).every(e=>e.data?.contentKind==='dat-city.district')&&window.__datCity.manager.isSettled,{},{timeout:120000});row.mobileDistricts=await page.evaluate(()=>[...window.__datCity.manager.entries.values()].filter(e=>e.kind==='district'&&!e.district.synthetic).length);assert.equal(row.mobileDistricts,row.districts.length);}
   await shot(`mobile-${original.slug}`);
   await page.locator('#edu-open').click();assert.equal(await page.locator('#edu-body').isVisible(),true);const bounds=await page.locator('#edu-body').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);await page.locator('[data-edu-tab="entender"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-edu-tab="investigar"]').getAttribute('aria-selected'),'true');await page.locator('#edu-close').click();row.mobile=true;
  }catch(error){row.failure=String(error);}
  console.log(JSON.stringify({slug:row.slug,desktop:row.desktop,mobile:row.mobile,errors:row.errors,missing:row.missing,failure:row.failure}));
  await writeFile(new URL('report.json',destination),JSON.stringify({base,total:originals.length,rows,checks},null,2));
 }
 row={slug:'native-control-checks',errors:[],missing:[],external:[]};
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 await check('bússola original: ímãs, limalha, carimbo e trilha',async()=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto(new URL('/originais/compass-field/',base).href);await ready();
  const values=await page.evaluate(()=>{const lab=window.__lab,before=lab.model();lab.setup(2,true);const now=performance.now();for(let i=0;i<90;i++)window.__step(now+i*16.667);lab.mark();for(let i=90;i<240;i++)window.__step(now+i*16.667);lab.trace();return {before,after:lab.model(),keys:Object.keys(lab)};});assert.ok(values.after.grains>1000);assert.ok(values.after.lines>0);assert.ok(values.after.stamps>values.before.stamps);assert.ok(values.after.walk>=values.before.walk);
 });
 await check('prisma original: presets alteram desvio e separação',async()=>{
  await page.goto(new URL('/originais/prism-room/',base).href);await ready();const values=await page.evaluate(()=>{window.__lab.preset(0);const a=window.__dbg();window.__lab.preset(3);return {a,b:window.__dbg()};});assert.ok(values.a.spread>0);assert.notDeepEqual(values.a,values.b);
 });
 await check('sifão original: tubo vazio interrompe vazão e enchimento restaura estado',async()=>{
  await page.goto(new URL('/originais/siphon-lab/',base).href);await ready();const values=await page.evaluate(()=>{window.__lab.empty();const now=performance.now();window.__step(now+100);const empty=window.__lab.model();window.__lab.full();return {empty,full:window.__lab.model()};});assert.equal(values.empty.Lmin,0);assert.equal(values.full.full,true);
 });
 await check('caderno original: CSV, JSON, recarga e impressão',async()=>{
  await page.evaluate(()=>{window.__EDU_NOTEBOOK__.open(true);window.__EDU_NOTEBOOK__.panel('investigar');});await page.locator('#edu-clear').click();await page.locator('#edu-record').click();
  for(const type of ['csv','json']){const pending=page.waitForEvent('download');await page.locator('#edu-'+type).click();const d=await pending;assert.ok((await readFile(await d.path(),'utf8')).includes('sourceHash'));}
  await page.locator('#edu-notes').fill('Minha hipótese');await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});assert.equal(await page.locator('#edu-print').isVisible(),true);assert.equal(await page.locator('canvas').first().isVisible(),false);assert.match(await page.locator('#edu-print').innerText(),/Minha hipótese/);await page.emulateMedia({media:'screen'});
 });
 await check('rota antiga da bússola abre cliente real e aba investigar',async()=>{await page.goto(new URL('/aula.html?id=bussola#investigar',base).href);await page.waitForURL('**/originais/compass-field/?caderno=investigar');await ready();assert.equal(await page.locator('#edu-body').isVisible(),true);});
 const report={base,total:originals.length,controlsOnly:process.env.EDU_QA_CONTROLS_ONLY==='1',desktop:rows.filter(r=>r.desktop).length,mobile:rows.filter(r=>r.mobile).length,checks,rows,controlErrors:row.errors,missing:[...missing],device:'mobile emulado; não testado em aparelho real',passed:rows.every(r=>r.desktop&&r.mobile&&!r.failure&&!r.errors.length&&!r.missing.length)&&!row.errors.length};
 await writeFile(new URL(process.env.EDU_QA_CONTROLS_ONLY==='1'?'controls.json':'report.json',destination),JSON.stringify(report,null,2));await writeFile(new URL('missing.txt',destination),[...missing].join('\n'));console.log(JSON.stringify({...report,rows:undefined}));assert.equal(report.passed,true);
}finally{await browser.close();}
