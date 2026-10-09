import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lessons,subjects} from '../src/edu-catalog.js';
import {defaults,evaluateLesson,model} from '../src/edu-models.js';
test('catálogo cobre todos os cards da fonte, sem confundir links externos e aulas',async()=>{
  const inventory=JSON.parse(await readFile(new URL('../src/edu-inventory.json',import.meta.url),'utf8'));
  assert.equal(inventory.length,57);assert.equal(new Set(inventory.map(i=>i.url)).size,57);
  assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
  assert.ok(lessons.filter(l=>!l.portable).every(l=>inventory.some(i=>i.url.replace(/\/$/,'')===l.source.replace(/\/$/,''))));
  assert.ok(lessons.filter(l=>l.portable).every(l=>l.engine==='three'&&l.sourceName&&l.scientific&&l.limit));
  assert.ok(subjects.filter(s=>s.id!=='todas').every(s=>lessons.some(l=>l.tags.includes(s.id))));
});
test('todos os modelos permanecem finitos nos extremos permitidos e ambos os controles mudam uma leitura',()=>{
  for(const l of lessons.filter(l=>!l.href)){
    const baseline=evaluateLesson(l,defaults(l));
    for(const c of l.controls){
      const min=evaluateLesson(l,{...defaults(l),[c.id]:c.min}),max=evaluateLesson(l,{...defaults(l),[c.id]:c.max});
      assert.ok(min.metrics.every(m=>Number.isFinite(m.value)),`${l.id}/${c.id}/min`);
      assert.ok(max.metrics.every(m=>Number.isFinite(m.value)),`${l.id}/${c.id}/max`);
      assert.ok(min.metrics.some((m,i)=>Math.abs(m.value-max.metrics[i].value)>1e-9),`${l.id}/${c.id} precisa afetar as leituras`);
    }
    for(const a of [l.controls[0].min,l.controls[0].max])for(const b of [l.controls[1].min,l.controls[1].max])assert.ok(model(l.mode,a,b).metrics.every(m=>Number.isFinite(m.value)),`${l.id} combinação extrema`);
    assert.deepEqual(evaluateLesson(l,defaults(l)),baseline);
  }
});
test('relações físicas e geométricas têm unidades e proporções corretas',()=>{
  assert.equal(model('pendulum',.5,2).value,2);
  assert.ok(Math.abs(model('prism',30,1.5).value-19.47122063449069)<1e-10);
  assert.equal(model('lens',16,8).value,16);
  assert.equal(model('brake',8,.4).value/model('brake',4,.4).value,4);
  assert.equal(model('wind',20,.5).value/model('wind',10,.5).value,4);
  assert.equal(model('heart',60,70).value,4.2);
  assert.equal(model('scale',1,2).value,8);
  assert.equal(model('graph',0,7).value,3);
  assert.equal(model('graph',3,3).value,0);
  assert.equal(model('fusion',30,100).value,0);
  assert.ok(model('tide',0,30).value>model('tide',90,30).value);
  assert.equal(model('energy',1000,4).value,4);
  assert.equal(model('traffic',18,60).value,0);
});
