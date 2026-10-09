import test from 'node:test';
import assert from 'node:assert/strict';
import {portedLessons} from '../src/edu-ports.js';
import {portState,rhythmPattern} from '../src/edu-port-models.js';
import {defaults} from '../src/edu-models.js';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('todos os modelos portados são finitos, reprodutíveis e limitados nos tempos e extremos da coleção',()=>{
 for(const lesson of portedLessons)for(const a of [lesson.controls[0].min,defaults(lesson).a,lesson.controls[0].max])for(const b of [lesson.controls[1].min,defaults(lesson).b,lesson.controls[1].max]){
  for(const time of [0,10,30,60])assert.ok(portState(lesson.mode,a,b,time).metrics.every(m=>Number.isFinite(m.value)),`${lesson.id}/${a}/${b}/${time}`);
  assert.deepEqual(portState(lesson.mode,a,b,10),portState(lesson.mode,a,b,10));
 }
});
test('difusão conserva soluto; membrana fechada não transporta e temperatura acelera mistura',()=>{
 for(const time of [0,10,100]){const d=portState('diffusion',25,80,time).data;close(d.left+d.right,100);close(portState('diffusion',25,0,time).data.right,0);}
 assert.ok(portState('diffusion',60,60,10).data.right>portState('diffusion',10,60,10).data.right);
});
test('osmose conserva volume e soluto, inverte com os lados e não flui sem gradiente',()=>{
 for(const time of [0,20,60,1000]){const d=portState('osmosis',80,30,time).data,reverse=portState('osmosis',30,80,time).data;close(d.leftVolume+d.rightVolume,2);close(d.left*d.leftVolume,80);close(d.right*d.rightVolume,30);close(d.leftVolume,reverse.rightVolume);close(portState('osmosis',50,50,time).data.leftVolume,1);}
 close(portState('osmosis',80,30,1000).data.pressure,0);
});
test('cinética conserva A+B; calor aumenta a conversão e concentração não altera fração convertida',()=>{
 for(const time of [0,10,100]){const d=portState('reaction',2,25,time).data;close(d.remaining+d.product,2);close(d.converted,portState('reaction',1,25,time).data.converted);}
 assert.ok(portState('reaction',1,50,10).data.product>portState('reaction',1,25,10).data.product);
});
test('frações preservam o inteiro e ritmos preservam a quantidade de palmas em oito passos',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=4;b++){const d=portState('fractions',a,b).data;close(d.numerator/d.denominator,a/6);}
 for(let a=1;a<=8;a++){assert.equal(rhythmPattern(a).length,8);assert.equal(rhythmPattern(a).filter(Boolean).length,a);close(portState('rhythm',a,120).value*2,portState('rhythm',a,60).value);}
});
test('circuitos respeitam conservação de tensão e corrente, e resistência equivalente',()=>{
 for(const a of [10,30,100])for(const b of [10,60,100]){const s=portState('series',a,b).data,p=portState('parallel',a,b).data;close(s.voltageA+s.voltageB,12);close(p.current,p.currentA+p.currentB);assert.ok(p.resistance<Math.min(a,b));close(12/p.resistance,p.current);}
});
test('montanha-russa conserva energia e massa não altera a velocidade ideal',()=>{
 for(const time of [0,2,5,10,30]){const light=portState('coaster',6,10,time).data,heavy=portState('coaster',6,100,time).data;close(light.potential+light.kinetic,10*9.81*6);close(light.speed,heavy.speed);close(heavy.total/light.total,10);}
});
test('órbita respeita periélio, afélio, período e retorno; trilateração recupera posição',()=>{
 for(const a of [.5,1,3])for(const b of [0,.4,.8]){const start=portState('ellipse',a,b,0).data,half=portState('ellipse',a,b,start.period*6).data,end=portState('ellipse',a,b,start.period*12).data;close(start.radius,a*(1-b));close(half.radius,a*(1+b));close(end.x,start.x);close(end.z,start.z);close(start.period**2,a**3);}
 for(const x of [-2,0,2])for(const z of [-1.5,0,1.5]){const [r0,r1,r2]=portState('gps',x,z).data.distances;close((r0*r0-r1*r1)/8,x);close((r0*r0-r2*r2-4*x-3.01)/6.6,z);}
});
test('Lotka–Volterra permanece positivo e preserva sua integral de movimento',()=>{
 for(const a of [.2,.6,1.2])for(const b of [.2,.5,1.2]){const invariant=d=>.02*d.prey-b*Math.log(d.prey)+.025*d.predators-a*Math.log(d.predators),initial=portState('predator',a,b).data;
  for(const t of [10,30,60]){const d=portState('predator',a,b,t).data;assert.ok(d.prey>0&&d.predators>0);close(invariant(d),invariant(initial),1e-4);}
 }
});
test('bandos têm limites periódicos e tráfego mantém espaço sem veículos atravessados',()=>{
 for(const time of [0,10,30,60]){const f=portState('flock',25,1.2,time).data;assert.ok(f.alignment>=0&&f.alignment<=1);assert.ok(f.agents.every(s=>s.x>=0&&s.x<6&&s.z>=0&&s.z<4));
  for(const n of [8,20,28]){const cars=portState('ringTraffic',n,14,time).data.cars;assert.ok(cars.every(s=>s.x>=0&&s.x<120&&s.v>=0&&s.v<=14));for(let i=0;i<n;i++)assert.ok(((cars[(i+1)%n].x-cars[i].x+120)%120)>=3,`colisão n=${n}, t=${time}`);}
 }
});
