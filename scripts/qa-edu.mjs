import {chromium} from '../../../libraries/metal-assault/lab/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {lessons,subjects,lessonUrl} from '../src/edu-catalog.js';
import {defaults,evaluateLesson} from '../src/edu-models.js';
const hub=fileURLToPath(new URL('../../../',import.meta.url));
const served=JSON.parse(execFileSync('python3',['framework/scripts/game.py','serve','apps/edu-rabisco','--json'],{cwd:hub,encoding:'utf8'}));
const base=served.url,destination=new URL('../../../output/edu-rabisco/qa/',import.meta.url);await mkdir(destination,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.QA_HEADED!=='1',args:['--use-angle=metal','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],checks=[],shots=[];let renderer='';
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>{if(new URL(r.url()).origin===new URL(base).origin&&r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
const shot=async name=>{const path=fileURLToPath(new URL(`${name}.png`,destination));await page.screenshot({path,fullPage:false});shots.push(path);};
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
try{
 await page.goto(base);await page.waitForFunction(()=>window.__EDU_HOME__?.ready,{timeout:30000});
 await check('catálogo integral, prévias e matérias',async()=>{const home=await page.evaluate(()=>window.__EDU_HOME__);assert.equal(home.count,lessons.length);assert.equal(home.previews,lessons.length);assert.equal(home.inventory,57);assert.equal(await page.locator('.card').count(),lessons.length);assert.equal(await page.locator('.source-list li').count(),57);});
 await shot('portal-desktop');
 await check('cada filtro mostra a coleção inteira da matéria',async()=>{for(const subject of subjects){await page.locator(`[data-subject="${subject.id}"]`).click();assert.equal(await page.locator('.card').count(),subject.id==='todas'?lessons.length:lessons.filter(l=>l.tags.includes(subject.id)).length);}await page.locator('[data-subject="todas"]').click();});
 await check('busca ignora acentos e aceita nenhum resultado',async()=>{await page.locator('#search').fill('pendulos');assert.equal(await page.locator('.card').count(),1);await page.locator('#search').fill('zzzzzzz');assert.equal(await page.locator('.card').count(),0);await page.locator('#clear-filter').click();assert.equal(await page.locator('.card').count(),lessons.length);});
 await check('experimento do hero altera fio e leitura',async()=>{await page.locator('#hero-change').click();assert.match(await page.locator('#hero-reading').textContent(),/iguais/);});
 const local=lessons.filter(l=>!l.href);
 for(const l of local){
  await page.goto(new URL(lessonUrl(l),base).href);await page.waitForFunction(()=>window.__EDU__?.ready);await page.waitForFunction(()=>window.__EDU__.observe().frames>2);
  await check(`ciclo completo ${l.id}`,async()=>{
   let state=await page.evaluate(()=>window.__EDU__.observe());assert.equal(state.playing,false);assert.deepEqual(state.values,defaults(l));assert.ok(state.metrics.every(m=>Number.isFinite(m.value)));renderer=state.renderer;assert.doesNotMatch(renderer,/SwiftShader|llvmpipe/i);
   for(const c of l.controls){await page.locator('#reset').click();state=await page.evaluate(()=>window.__EDU__.observe());const before=state.metrics.map(m=>m.value),changed=c.value===c.max?c.min:c.max;await page.locator(`#control-${c.id}`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},changed);state=await page.evaluate(()=>window.__EDU__.observe());assert.equal(state.values[c.id],changed);assert.equal(state.playing,false);assert.equal(state.time,0);assert.ok(state.metrics.some((m,i)=>m.value!==before[i]),`${l.id}/${c.id}`);}
   await page.locator('#reset').click();state=await page.evaluate(()=>window.__EDU__.observe());assert.deepEqual(state.values,defaults(l));
   await page.locator('#step').click();assert.equal((await page.evaluate(()=>window.__EDU__.observe())).time,.5);
   await page.locator('#play').click();await page.waitForTimeout(100);await page.locator('#play').click();assert.ok((await page.evaluate(()=>window.__EDU__.observe())).time>.5);
   await page.locator('#tab-investigar').click();await page.locator('#clear-records').click();await page.locator('#record').click();await page.locator('#control-a').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},l.controls[0].max);await page.locator('#record').click();assert.equal(await page.locator('#records tbody tr').count(),2);
   await page.locator('#hypothesis').fill('Minha hipótese fica nesta página.');await page.reload();await page.waitForFunction(()=>window.__EDU__?.ready);assert.equal(await page.locator('#records tbody tr').count(),2);assert.equal(await page.locator('#hypothesis').inputValue(),'');
   await page.locator('#tab-professor').click();assert.equal(await page.locator('.teacher-plan li').count(),5);assert.match(await page.locator('#professor').textContent(),/limita/);await page.locator('#reset').click();
  });
  await page.locator('#tab-entender').click();await shot(`aula-${l.id}`);
 }
 await check('cadernos herdados e laboratórios reais acessíveis',async()=>{for(const path of ['/geografia.html','/escola.html','/terremotos.html','/ficha.html','/ficha-terremotos.html','/laboratorio.html']){const response=await page.goto(new URL(path,base).href);assert.equal(response.status(),200);if(path==='/laboratorio.html'){await page.waitForFunction(()=>window.__AMAZONAS__?.ready);assert.ok(await page.locator('canvas').count());}if(path==='/terremotos.html'){await page.waitForFunction(()=>window.__TERREMOTOS__?.ready);assert.ok(await page.locator('#quake-stage canvas').count());}}});
 await page.goto(new URL('/aula.html?id=pendulos',base).href);await page.waitForFunction(()=>window.__EDU__?.ready);
 await check('teclado opera variáveis e as três abas',async()=>{await page.locator('#control-a').focus();await page.keyboard.press('ArrowRight');assert.ok((await page.evaluate(()=>window.__EDU__.observe())).values.a>defaults(local[0]).a);await page.locator('#tab-entender').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-investigar').getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.locator('#tab-professor').getAttribute('aria-selected'),'true');});
 await check('ficha inclui ensaios e usa somente conteúdo de impressão',async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});assert.equal(await page.locator('.print-sheet').isVisible(),true);assert.equal(await page.locator('.lab-layout').isVisible(),false);assert.ok(await page.locator('#print-records tr').count()>=3);await page.pdf({path:fileURLToPath(new URL('ficha-pendulos.pdf',destination)),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});});
 await check('parâmetro inválido oferece volta ao catálogo',async()=>{await page.goto(new URL('/aula.html?id=nao-existe',base).href);assert.match(await page.locator('main').textContent(),/não foi encontrada/);});
 await check('mobile emulado sem overflow: catálogo e todas as aulas',async()=>{await page.setViewportSize({width:390,height:844});await page.goto(base);await page.waitForFunction(()=>window.__EDU_HOME__?.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('portal-mobile');for(const l of local){await page.goto(new URL(lessonUrl(l),base).href);await page.waitForFunction(()=>window.__EDU__?.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),l.id);}await shot('aula-mobile');});
 await check('materiais locais continuam acessíveis sem rede',async()=>{await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.startsWith('Materiais disponíveis'));await context.setOffline(true);for(const l of lessons){await page.goto(new URL(lessonUrl(l),base).href);if(!l.href)await page.waitForFunction(()=>window.__EDU__?.ready);assert.ok(await page.locator('h1:visible').textContent());}await context.setOffline(false);});
 await check('WebGL indisponível mantém investigação, leituras e ficha',async()=>{const fallback=await browser.newContext({viewport:{width:1280,height:900}});await fallback.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:old.call(this,type,...args);};});const p=await fallback.newPage();await p.goto(new URL('/aula.html?id=pendulos',base).href);await p.waitForFunction(()=>window.__EDU__?.ready);assert.equal(await p.locator('.no-webgl').isVisible(),true);assert.equal(await p.locator('#metrics .metric').count(),3);await p.locator('#tab-investigar').click();await p.locator('#record').click();assert.equal(await p.locator('#records tbody tr').count(),1);await fallback.close();});
 assert.deepEqual(errors,[]);
 const inventory=JSON.parse(await readFile(new URL('../src/edu-inventory.json',import.meta.url),'utf8'));
 const report={url:base,passed:true,checks:checks.length,lessons:lessons.length,newLabs:local.length,referenceCount:inventory.length,adaptedReferences:lessons.length,externalReferences:inventory.length-lessons.length,renderer,device:'mobile emulado; não testado em aparelho real',errors,shots,tests:checks};
 await writeFile(new URL('report.json',destination),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,shots:shots.length,tests:undefined}));
}finally{await browser.close();}
