import {chromium} from '../../../libraries/metal-assault/lab/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let base=process.env.EDU_QA_URL||JSON.parse(execFileSync('python3',['framework/scripts/game.py','serve','apps/edu-rabisco','--json'],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),encoding:'utf8'})).url;
if(base&&new URL(base).hostname==='localhost'){const local=new URL(base);local.hostname='edu-qa.test';base=local.href;}
assert.ok(base,'Informe EDU_QA_URL');
const pages=JSON.parse(await readFile(new URL('../public/originais/pages.json',import.meta.url),'utf8')).filter(p=>p.slug.startsWith('dat-city/stories/'));
assert.equal(pages.length,64);
const output=new URL('../../../output/edu-rabisco/qa-dat-stories/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.QA_HEADED!=='1',args:['--use-angle=metal','--ignore-gpu-blocklist','--host-resolver-rules=MAP edu-qa.test 127.0.0.1']});
const rows=[];let next=0;const navigation=[];
try{
 await Promise.all([0,1].map(async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'}),page=await context.newPage();let row;
  page.on('pageerror',e=>row?.errors.push(String(e)));
  page.on('response',r=>{if((r.status()>=400||(r.status()>=200&&r.status()<300&&r.request().resourceType()==='stylesheet'&&!r.headers()['content-type']?.includes('css')))&&new URL(r.url()).origin===new URL(base).origin)row?.missing.push({url:r.url(),status:r.status()});});
  while(next<pages.length){const source=pages[next++];row={slug:source.slug,errors:[],missing:[],desktop:false,mobile:false};rows.push(row);
   try{
    await page.setViewportSize({width:1440,height:1050});await page.goto(new URL(source.url,base).href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.dataset.storyDataVersionId==='20260903T060326Z',{},{timeout:45000});
    const embed=page.locator('[data-story-district-embed]').first();await embed.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('[data-story-district-embed] canvas.is-ready'),{},{timeout:60000});
    row.version=await page.locator('body').getAttribute('data-story-data-version-id');assert.equal(await page.locator('[data-ranking-rows] .ranking-row').count()>0,true);
    row.desktop=true;await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);const bounds=await embed.boundingBox();assert.ok(bounds.width<=390);assert.ok(await page.locator('[data-story-district-embed] canvas.is-ready').count());row.mobile=true;
    if(source.slug.endsWith('/top-youtubers')){
     await page.screenshot({path:new URL('top-youtubers.png',output).pathname});
     await page.getByRole('link',{name:'All stories',exact:true}).click();await page.waitForURL('**/originais/dat-city/stories/');await page.waitForTimeout(800);
     assert.ok(await page.locator('a[href^="/originais/dat-city/stories/"]').count()>=64);navigation.push('All stories abre índice original local com 64 histórias');
    }
   }catch(e){row.failure=String(e);}
   console.log(JSON.stringify(row));
  }
  await context.close();
 }));
 const report={base,total:pages.length,desktop:rows.filter(r=>r.desktop).length,mobileEmulated:rows.filter(r=>r.mobile).length,navigation,rows,passed:rows.length===pages.length&&rows.every(r=>r.desktop&&r.mobile&&!r.failure&&!r.errors.length&&!r.missing.length)};
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));assert.equal(report.passed,true);
}finally{await browser.close();}
