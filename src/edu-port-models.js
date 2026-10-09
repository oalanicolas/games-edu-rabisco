export const portedModes = new Set(['diffusion','osmosis','reaction','dna','fractions','probability','balance','function','predator','flock','ringTraffic','feedback','rhythm','series','parallel','ellipse','gps','gearPair','coaster','resonance']);
export const simulationLimits = { predator:60, flock:60, ringTraffic:60, feedback:30, coaster:60 };
const read = (label, value, unit = '') => ({ label, value, unit });
const timelines = new Map();
const wrap = (x, size) => ((x % size) + size) % size;
const random = seed => () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
const draws = Array.from({length:120}, random(142857));
export const rhythmPattern = count => Array.from({length:8}, (_,i) => Math.floor((i+1)*count/8) !== Math.floor(i*count/8));
export const landmarks = [[-2,-1.5],[2,-1.5],[0,1.8]];
const rk4 = (state, dt, f) => {
  const k1=f(state), k2=f(state.map((v,i)=>v+dt*k1[i]/2)), k3=f(state.map((v,i)=>v+dt*k2[i]/2)), k4=f(state.map((v,i)=>v+dt*k3[i]));
  return state.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
};
function timeline(mode, a, b) {
  const key=`${mode}:${a}:${b}`;
  if(timelines.has(key))return timelines.get(key);
  const frames=[],dt=mode==='ringTraffic'?.05:mode==='coaster'?.02:.1;
  const rng=random(20261009);
  let state=mode==='predator'?[Math.log(40),Math.log(20)]:mode==='coaster'?[.01]:mode==='flock'
    ?Array.from({length:24},()=>({x:rng()*6,z:rng()*4,heading:rng()*Math.PI*2}))
    :Array.from({length:a},(_,i)=>({x:i*120/a,v:b}));
  for(let step=0;step<=Math.round(60/dt);step++){
    frames.push(mode==='predator'?state.map(Math.exp):mode==='coaster'?state[0]:state.map(s=>({...s})));
    if(mode==='predator')state=rk4(state,dt,([u,v])=>[a-.025*Math.exp(v),.02*Math.exp(u)-b]);
    if(mode==='coaster')state=rk4(state,dt,([u])=>{
      const h=a*(1+Math.cos(u*2*Math.PI))/2, slope=-a*Math.PI*Math.sin(u*2*Math.PI);
      return [u>=1?0:Math.sqrt(Math.max(0,2*9.81*(a-h)))/Math.hypot(20,slope)];
    }).map(u=>Math.min(1,u));
    if(mode==='flock'){
      const previous=state;
      state=previous.map(agent=>{
        let x=0,z=0;
        for(const other of previous){let dx=Math.abs(other.x-agent.x),dz=Math.abs(other.z-agent.z);dx=Math.min(dx,6-dx);dz=Math.min(dz,4-dz);if(dx*dx+dz*dz<=b*b){x+=Math.cos(other.heading);z+=Math.sin(other.heading);}}
        const heading=Math.atan2(z,x)+(rng()-.5)*Math.PI*2*a/100;
        return {x:wrap(agent.x+.7*dt*Math.cos(heading),6),z:wrap(agent.z+.7*dt*Math.sin(heading),4),heading};
      });
    }
    if(mode==='ringTraffic'){
      const previous=state;
      state=previous.map((car,i)=>{
        const gap=wrap(previous[(i+1)%a].x-car.x,120)-3;
        const target=Math.min(b,Math.max(0,gap)*.6)*(i===0&&step*dt<3?.25:1);
        const speed=Math.max(0,Math.min(b,car.v+.8*(target-car.v)*dt,Math.max(0,gap-.01)/dt));
        return {x:wrap(car.x+speed*dt,120),v:speed};
      });
    }
  }
  const result={frames,dt};timelines.set(key,result);
  if(timelines.size>16)timelines.delete(timelines.keys().next().value);
  return result;
}
export function portState(mode, a, b, time = 0) {
  const t=Math.max(0,Math.min(time,simulationLimits[mode]??time));
  let metrics=[],value=0,data={};
  switch(mode){
    case 'diffusion': {
      const k=.05*(a+273.15)/298.15*b/100,left=50+50*Math.exp(-2*k*t),right=100-left;
      data={k,left,right};value=right;metrics=[read('Esquerda',left,'mmol/L'),read('Direita',right,'mmol/L'),read('Troca k',k,'s⁻¹')];break;
    }
    case 'osmosis': {
      const leftVolume=1+(2*a/(a+b)-1)*(1-Math.exp(-t/20)),rightVolume=2-leftVolume;
      const left=a/leftVolume,right=b/rightVolume,pressure=8.314*298.15*(left-right)/1000;
      data={leftVolume,rightVolume,left,right,pressure};value=pressure;
      metrics=[read('Volume à esquerda',leftVolume,'L'),read('Volume à direita',rightVolume,'L'),read('π esquerda − direita',pressure,'kPa')];break;
    }
    case 'reaction': {
      const k=.03*Math.exp(-25000/8.314*(1/(b+273.15)-1/298.15)),remaining=a*Math.exp(-k*t),product=a-remaining;
      data={k,remaining,product,converted:product/a};value=product;metrics=[read('Reagente A',remaining,'mol/L'),read('Produto B',product,'mol/L'),read('Taxa inicial',k*a,'mol/L/s')];break;
    }
    case 'dna': {const gc=Math.round(b*a/100),at=b-gc;data={gc,at,bonds:gc*3+at*2};value=data.bonds;metrics=[read('Pares G–C',gc),read('Pares A–T',at),read('Ligações entre bases',value)];break;}
    case 'fractions': data={numerator:a*b,denominator:6*b};value=a/6;metrics=[read('Parte do inteiro',value*100,'%'),read('Novo numerador',a*b),read('Novo denominador',6*b)];break;
    case 'probability': {const completed=Math.min(b,Math.floor(t*8)),successes=draws.slice(0,completed).filter(x=>x<a/100).length;data={completed,successes,draws:draws.slice(0,b).map(x=>x<a/100)};value=successes;metrics=[read('Sucessos observados',successes),read('Sorteios concluídos',completed),read('Sucessos esperados ao final',b*a/100)];break;}
    case 'balance': value=b/a;data={x:value};metrics=[read('Cada caixa x',value,'unid.'),read('Caixas',a),read('Peso de cada lado',b,'unid.')];break;
    case 'function': value=2*a+b;data={slope:a,intercept:b};metrics=[read('f(−2)',-2*a+b),read('f(0)',b),read('f(2)',value)];break;
    case 'predator': {const {frames,dt}=timeline(mode,a,b),frame=frames[Math.min(frames.length-1,Math.floor(t/dt))];data={prey:frame[0],predators:frame[1]};value=data.prey;metrics=[read('Presas',data.prey,'pop. contínua'),read('Predadores',data.predators,'pop. contínua'),read('Presas no equilíbrio',b/.02),read('Predadores no equilíbrio',a/.025)];break;}
    case 'flock': {const {frames,dt}=timeline(mode,a,b),agents=frames[Math.min(frames.length-1,Math.floor(t/dt))];const alignment=Math.hypot(agents.reduce((n,s)=>n+Math.cos(s.heading),0),agents.reduce((n,s)=>n+Math.sin(s.heading),0))/agents.length;data={agents,alignment};value=alignment;metrics=[read('Alinhamento',alignment*100,'%'),read('Ruído',a,'%'),read('Raio dos vizinhos',b,'unid.')];break;}
    case 'ringTraffic': {const {frames,dt}=timeline(mode,a,b),cars=frames[Math.min(frames.length-1,Math.floor(t/dt))];value=cars.reduce((n,s)=>n+s.v,0)/a;data={cars};metrics=[read('Velocidade média',value,'m/s'),read('Espaço médio livre',120/a-3,'m'),read('Velocidade desejada',b,'m/s')];break;}
    case 'feedback': value=a*Math.exp(b*t/5);data={stock:value};metrics=[read('Intensidade atual',value,'unid.'),read('Ganho do retorno',b),read('Impulso inicial',a,'unid.')];break;
    case 'rhythm': {const pattern=rhythmPattern(a),step=Math.floor(t*b/60);data={pattern,step,active:step%8};value=480/b;metrics=[read('Duração do ciclo',value,'s'),read('Palmas por ciclo',a),read('Palmas por minuto',a*b/8)];break;}
    case 'series': {const resistance=a+b,current=12/resistance;data={resistance,current,voltageA:current*a,voltageB:current*b};value=current;metrics=[read('Resistência total',resistance,'Ω'),read('Corrente',current*1000,'mA'),read('Tensão A',data.voltageA,'V'),read('Tensão B',data.voltageB,'V')];break;}
    case 'parallel': {const currentA=12/a,currentB=12/b;data={currentA,currentB,resistance:a*b/(a+b),current:currentA+currentB};value=data.current;metrics=[read('Resistência equivalente',data.resistance,'Ω'),read('Corrente A',currentA*1000,'mA'),read('Corrente B',currentB*1000,'mA'),read('Corrente total',value*1000,'mA')];break;}
    case 'ellipse': {
      const period=a**1.5,mean=2*Math.PI*t/(12*period);let eccentric=mean;
      for(let i=0;i<12;i++)eccentric-=(eccentric-b*Math.sin(eccentric)-mean)/(1-b*Math.cos(eccentric));
      const x=a*(Math.cos(eccentric)-b),z=a*Math.sqrt(1-b*b)*Math.sin(eccentric),radius=Math.hypot(x,z);
      data={period,x,z,radius,eccentric};value=period;metrics=[read('Período',period,'anos'),read('Periélio',a*(1-b),'UA'),read('Afélio',a*(1+b),'UA'),read('Distância atual',radius,'UA')];break;
    }
    case 'gps': {const distances=landmarks.map(([x,z])=>Math.hypot(x-a,z-b));data={distances};value=distances[0];metrics=distances.map((d,i)=>read(`Distância ao marco ${i+1}`,d,'km'));break;}
    case 'gearPair': value=60*a/b;data={rpm:value};metrics=[read('Rotação da movida',value,'rpm'),read('Dentes da motora',a),read('Dentes da movida',b)];break;
    case 'coaster': {
      const {frames,dt}=timeline(mode,a,b),u=frames[Math.min(frames.length-1,Math.floor(t/dt))],height=a*(1+Math.cos(u*Math.PI*2))/2,total=b*9.81*a,potential=b*9.81*height,kinetic=total-potential;
      data={u,height,total,potential,kinetic,speed:Math.sqrt(2*kinetic/b)};value=data.speed;
      metrics=[read('Velocidade',data.speed,'m/s'),read('Potencial',potential,'J'),read('Cinética',kinetic,'J'),read('Energia total',total,'J')];break;
    }
    case 'resonance': value=(2*b-1)*343/(4*a/100);data={frequency:value,fundamental:343/(4*a/100)};metrics=[read('Frequência do modo',value,'Hz'),read('Fundamental',data.fundamental,'Hz'),read('Modo',b)];break;
    default: throw new Error(`Unknown portable model: ${mode}`);
  }
  return {metrics,value,data};
}
