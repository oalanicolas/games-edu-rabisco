import * as THREE from 'three';
import { portState, landmarks } from './edu-port-models.js';

export function buildPortScene(mode, values, h) {
  const {root,dynamic,mesh,box,sphere,cylinder,line,tube,label,arrow,ring,pointsOn,v,ink,blue,green,orange,red,cream}=h;
  const {a,b}=values,initial=portState(mode,a,b).data;
  const group = objects => {const g=new THREE.Group();root.add(g);for(const object of objects)g.attach(object);return g;};
  switch(mode){
    case 'diffusion': {
      for(const x of [-1.5,1.5]){box(2.55,1.7,1.8,0x99bdc2,x,1,0).material.setValues({transparent:true,opacity:.15,depthWrite:false});box(2.55,.1,1.8,blue,x,.17,0);}
      for(let i=0;i<8;i++){box(.06,1.7,.11,ink,0,1,-.85+i*.24);}
      const dots=Array.from({length:80},(_,i)=>sphere(.07,i%2?blue:orange));
      dynamic.push(t=>{const right=Math.round(portState(mode,a,b,t).data.right/100*dots.length);dots.forEach((dot,i)=>{const side=i<right?1:-1;const phase=t*(a+273.15)/298.15;dot.position.set(side*1.5+Math.sin(i*4.71+phase*.8)*.95,.4+(Math.sin(i*1.8+phase)*.5+.5)*1.1,Math.cos(i*3.1+phase*.6)*.68);});});
      label('esquerda',-1.5,2.4);label('direita',1.5,2.4);label('membrana',0,.16,1.7);break;
    }
    case 'osmosis': {
      const water=[];
      for(const x of [-1.55,1.55]){cylinder(1.05,2.5,0x9aafb3,x,1.4,0).material.setValues({transparent:true,opacity:.17,depthWrite:false});water.push(cylinder(.96,.9,blue,x,.7,0));ring(1.04,ink,x,2.66,0).rotation.x=Math.PI/2;}
      tube([v(-1.55,.5),v(-1.55,.22),v(1.55,.22),v(1.55,.5)],.065,ink);box(.09,.6,.5,cream,0,.38,0);
      const solutes=[];
      for(const [x,count] of [[-1.55,Math.round(a/5)],[1.55,Math.round(b/5)]]){const dots=[];for(let i=0;i<count;i++)dots.push(sphere(.085,orange,x+Math.sin(i*2.4)*.7,.42+(i%4)*.15,Math.cos(i*2.4)*.7));solutes.push(dots);}
      dynamic.push(t=>{const d=portState(mode,a,b,t).data;[d.leftVolume,d.rightVolume].forEach((volume,i)=>{water[i].scale.y=volume;water[i].position.y=.26+.45*volume;solutes[i].forEach((dot,j)=>dot.position.y=.3+volume*(.12+(j%4)*.17));});});
      label('água pode passar',0,3.1);label('soluto fica',0,.16,1.8);break;
    }
    case 'reaction': {
      cylinder(2.05,2.3,0x98b8be,0,1.35,0).material.setValues({transparent:true,opacity:.15,depthWrite:false});ring(2.05,ink,0,2.5,0).rotation.x=Math.PI/2;
      const dots=Array.from({length:Math.round(a*24)},()=>sphere(.11,blue));
      dynamic.push(t=>{const converted=portState(mode,a,b,t).data.converted;dots.forEach((dot,i)=>{dot.material.color.setHex(i/dots.length<converted?orange:blue);const phase=t*(b+273.15)/298.15;dot.position.set(Math.sin(i*2.4+phase*.4)*1.5,.35+(Math.sin(i*4.3+phase)*.5+.5)*1.8,Math.cos(i*2.4+phase*.4)*1.5);});});
      label('A → B',0,3.1);label('azul: A · laranja: B',0,.1,1.8);break;
    }
    case 'dna': {
      const parts=[],height=2.5,colors={A:orange,T:blue,G:green,C:red};
      for(let i=0;i<b;i++){
        const theta=i*Math.PI*2/10,y=.4+i*height/(b-1),left=v(Math.cos(theta)*.7,y,Math.sin(theta)*.7),right=v(-left.x,y,-left.z);
        const names=i<initial.gc?['G','C']:['A','T'];parts.push(sphere(.1,ink,...left.toArray()),sphere(.1,ink,...right.toArray()));
        parts.push(tube([left,right],.045,colors[names[0]]));
        for(const [j,p] of [left.clone().multiplyScalar(.4),right.clone().multiplyScalar(.4)].entries()){p.y=y;parts.push(sphere(.13,colors[names[j]],...p.toArray()));}
      }
      for(const sign of [-1,1])parts.push(tube(pointsOn(u=>v(sign*Math.cos(u*(b-1)*Math.PI*2/10)*.7,.4+u*height,sign*Math.sin(u*(b-1)*Math.PI*2/10)*.7),b*8),.06,ink));
      const dna=group(parts);dynamic.push(t=>dna.rotation.y=t*.13);
      label('A–T: 2',-1.5,.25,1.6).scale.set(2,.5,1);label('G–C: 3',1.5,.25,1.6).scale.set(2,.5,1);break;
    }
    case 'fractions': {
      for(const [row,count,filled] of [[0,6,a],[1,6*b,a*b]]){
        box(5.25,.15,.85,ink,0,.35,-.85+row*1.65);
        for(let i=0;i<count;i++)box(5/count-.025,.28,.75,i<filled?(row?orange:blue):cream,-2.5+(i+.5)*5/count,.52,-.85+row*1.65);
        label(`${filled}/${count}`,0,1.3,-.85+row*1.65);
      }
      label('o mesmo inteiro',0,2.55);break;
    }
    case 'probability': {
      const tiles=Array.from({length:b},(_,i)=>box(.31,.12,.31,cream,-2.45+(i%12)*.44,.25,-1.6+Math.floor(i/12)*.35));
      dynamic.push(t=>{const d=portState(mode,a,b,t).data;tiles.forEach((tile,i)=>{tile.material.color.setHex(i<d.completed?(d.draws[i]?green:orange):cream);tile.scale.y=i===d.completed?2:1;});});
      label('verde: sucesso · laranja: outro',0,2.2);break;
    }
    case 'balance': {
      mesh(new THREE.ConeGeometry(.35,1.6,4),ink,0,.9,0);box(4.5,.12,.2,ink,0,1.85,0);
      for(const x of [-1.85,1.85]){cylinder(.95,.1,cream,x,.9,0);for(const z of [-.7,.7])tube([v(x-.55,.9,z),v(x,1.85),v(x+.55,.9,z)],.02,ink);}
      for(let i=0;i<a;i++){box(.32,.38,.32,blue,-2.35+(i%3)*.42,1.16+Math.floor(i/3)*.4,0);}
      for(let i=0;i<b;i++)cylinder(.13,.2,orange,1.35+(i%4)*.32,1.1+Math.floor(i/4)*.21,0);
      label(`${a} × x`, -1.85,2.8);label(`${b} unidades`,1.85,2.8);break;
    }
    case 'function': {
      box(5.65,3,.1,cream,0,1.65,-.25);
      for(let i=-2;i<=2;i++){line([v(i*1.2,.3),v(i*1.2,3)],0xd3d6c6);if(i!==0)label(String(i),i*1.2,1.34,.1).scale.set(1,.25,1);}
      arrow(v(-2.6,1.65),v(2.6,1.65),ink);arrow(v(0,.3),v(0,3),ink);
      line(pointsOn(u=>{const x=-2+u*4;return v(x*1.2,1.65+(a*x+b)*.17,.06);}),blue);
      for(const x of [-2,0,2])sphere(.08,orange,x*1.2,1.65+(a*x+b)*.17,.1);
      label(`f(x) = ${a}x + ${b}`,0,3.35);label('x',2.8,1.6);break;
    }
    case 'predator': {
      cylinder(2.4,.15,0xadb994,0,.16,0);const populations=[];
      for(const [color,x] of [[green,-1.25],[orange,1.25]]){const symbols=Array.from({length:48},(_,i)=>sphere(.09,color,x+Math.sin(i*2.4)*.8,.38,Math.cos(i*2.4)*.85));populations.push(symbols);}
      dynamic.push(t=>{const d=portState(mode,a,b,t).data;[d.prey,d.predators].forEach((n,j)=>populations[j].forEach((dot,i)=>{dot.visible=i<Math.min(48,Math.ceil(n));dot.scale.setScalar(.7+Math.min(1.7,Math.sqrt(n/48)));dot.position.y=.38+Math.sin(t*.6+i)*.07;}));});
      label('presas',-1.3,2.2);label('predadores',1.3,2.2);label('símbolos resumem populações',0,3.15);break;
    }
    case 'flock': {
      const birds=Array.from({length:24},(_,i)=>{const bird=mesh(new THREE.ConeGeometry(.11,.38,3),i?blue:orange);bird.geometry.rotateZ(-Math.PI/2);return bird;});
      dynamic.push(t=>portState(mode,a,b,t).data.agents.forEach((agent,i)=>{birds[i].position.set(agent.x-3,.5,agent.z-2);birds[i].rotation.y=-agent.heading;}));
      label('cada um segue os vizinhos',0,2.8);label('bordas conectadas',0,.12,2.3);break;
    }
    case 'ringTraffic': {
      ring(1.85,ink,0,.18,0).rotation.x=Math.PI/2;ring(2.25,ink,0,.18,0).rotation.x=Math.PI/2;
      const cars=Array.from({length:a},(_,i)=>{const body=box(.17,.14,.28,i?blue:orange),window=box(.13,.04,.12,cream,0,.1,0);const car=group([body,window]);return car;});
      dynamic.push(t=>portState(mode,a,b,t).data.cars.forEach((car,i)=>{const angle=car.x/120*Math.PI*2;cars[i].position.set(Math.cos(angle)*2.05,.32,Math.sin(angle)*2.05);cars[i].rotation.y=-angle;}));
      label('primeiro carro freia por 3 s',0,2.85);break;
    }
    case 'feedback': {
      const stock=sphere(.55,blue,0,1.45,0),loop=[v(.4,1.5),v(1.9,2.4),v(2.7,1),v(1.2,.35),v(.4,1.1)];tube(loop,.045,b>=0?green:red);
      arrow(v(-2.9,1.5),v(-.9,1.5),orange);arrow(v(1.2,.35),v(.4,1.1),b>=0?green:red);
      dynamic.push(t=>stock.scale.setScalar(.6+Math.log1p(portState(mode,a,b,t).data.stock)*.38));
      label('impulso',-2.2,2.5);label(b<0?'retorno −':b>0?'retorno +':'sem retorno',1.8,3);label('escala visual logarítmica',0,.12,1.5);break;
    }
    case 'rhythm': {
      const pads=Array.from({length:8},(_,i)=>{const pad=cylinder(.28,.16,initial.pattern[i]?blue:cream,-2.65+i*.75,.28,0);ring(.29,ink,-2.65+i*.75,.38,0).rotation.x=Math.PI/2;label(String(i+1),-2.65+i*.75,.12,1).scale.set(1,.25,1);return pad;});
      const marker=sphere(.13,orange,-2.65,1.1,0);
      dynamic.push(t=>{const d=portState(mode,a,b,t).data;marker.position.x=-2.65+d.active*.75;pads.forEach((pad,i)=>{pad.scale.y=i===d.active?2:1;pad.material.color.setHex(i===d.active&&d.pattern[i]?orange:d.pattern[i]?blue:cream);});});
      label('oito passos · um ciclo',0,2.6);break;
    }
    case 'series': case 'parallel': {
      const battery=box(.6,1,.45,ink,-2.5,1.1,0);box(.12,.22,.13,orange,-2.5,1.74,0);label('12 V',-2.5,2.25);
      const paths=mode==='series'?[[v(-2.5,1.5),v(2.4,1.5),v(2.4,.5),v(-2.5,.5),v(-2.5,1.5)]]
        :[[v(-2.5,1.5),v(-1.5,1.5),v(-1.5,2.4),v(2.2,2.4),v(2.2,.5),v(-2.5,.5),v(-2.5,1.5)],[v(-1.5,1.5),v(2.2,1.5),v(2.2,.5)]];
      for(const path of paths)tube(path,.035,ink);
      const positions=mode==='series'?[[-.7,1.5],[1,1.5]]:[[.3,2.4],[.3,1.5]];
      for(const [i,[x,y]] of positions.entries()){box(.7,.24,.35,i?orange:blue,x,y,0);label(`${i?'B':'A'} · ${i?b:a} Ω`,x,y+.48).scale.set(2,.5,1);}
      paths.forEach((path,j)=>{const curve=new THREE.CatmullRomCurve3(path),current=mode==='series'?initial.current:j?initial.currentB:initial.currentA;for(let i=0;i<9;i++){const dot=sphere(.05,green);dynamic.push(t=>dot.position.copy(curve.getPoint((t*current*.22+i/9)%1)));}});
      label('corrente convencional',0,.12,1.5);break;
    }
    case 'ellipse': {
      const scale=2.6/(a*(1+b));sphere(.25,orange,0,.65,0);const orbit=pointsOn(u=>v(a*(Math.cos(u*Math.PI*2)-b)*scale,.65,a*Math.sqrt(1-b*b)*Math.sin(u*Math.PI*2)*scale),160);line(orbit,ink);
      const planet=sphere(.12,blue),radius=line([v(0,.65),v(0,.65)],orange);
      dynamic.push(t=>{const d=portState(mode,a,b,t).data;planet.position.set(d.x*scale,.65,d.z*scale);const p=radius.geometry.attributes.position;p.setXYZ(1,planet.position.x,.65,planet.position.z);p.needsUpdate=true;radius.geometry.computeBoundingSphere();});
      label('Sol em um foco',0,2.5);label('12 s = 1 ano',0,.12,1.8);break;
    }
    case 'gps': {
      const colors=[blue,green,orange],scale=.47;
      landmarks.forEach(([x,z],i)=>{cylinder(.06,.9,colors[i],x,.65,z);sphere(.12,colors[i],x,1.2,z);label(String(i+1),x,1.65,z).scale.set(1,.25,1);
        line(pointsOn(u=>v(x+initial.distances[i]*Math.cos(u*Math.PI*2),.15,z+initial.distances[i]*Math.sin(u*Math.PI*2)),180),colors[i]);line([v(x,.2,z),v(a,.2,b)],colors[i]);});
      cylinder(.18,.25,red,a,.3,b);sphere(.12,red,a,.55,b);label('receptor',a,1.15,b).scale.set(1.8,.45,1);
      const objects=root.children.filter(o=>o.position.y>0||o.isLine);const overlay=group(objects);overlay.scale.setScalar(scale*1.6);label('trilateração plana',0,3);break;
    }
    case 'gearPair': {
      const size=.045,radii=[a*size,b*size],centers=[-radii[1],radii[0]],gears=[];
      for(const [j,count] of [a,b].entries()){
        const r=radii[j],parts=[];const wheel=cylinder(r,.2,j?orange:blue);wheel.rotation.x=Math.PI/2;parts.push(wheel);
        for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,tooth=box(.13,.17,.22,j?orange:blue,Math.cos(angle)*(r+.04),Math.sin(angle)*(r+.04),0);tooth.rotation.z=angle-Math.PI/2;parts.push(tooth);}
        const g=group(parts);g.position.set(centers[j],1.7,0);gears.push(g);cylinder(.09,.35,cream,centers[j],1.7,.15).rotation.x=Math.PI/2;
      }
      dynamic.push(t=>{gears[0].rotation.z=t*Math.PI*2/5;gears[1].rotation.z=-t*Math.PI*2*a/b/5+Math.PI/b;});
      label('motora · 60 rpm',centers[0],3.55).scale.set(2.1,.52,1);label('movida',centers[1],3.55).scale.set(2,.5,1);break;
    }
    case 'coaster': {
      const position=u=>v(-2.8+u*5.6,.35+a*(1+Math.cos(u*Math.PI*2))*.13,0);
      for(const z of [-.25,.25])tube(pointsOn(u=>{const p=position(u);p.z=z;return p;}),.045,ink);
      for(let i=0;i<=12;i++){const p=position(i/12);box(.035,p.y,.035,0x91a397,p.x,p.y/2,-.25);box(.035,p.y,.035,0x91a397,p.x,p.y/2,.25);}
      const car=box(.35,.18,.5,orange);dynamic.push(t=>{const d=portState(mode,a,b,t).data;car.position.copy(position(d.u));car.position.y+=.14;car.rotation.z=Math.atan2(-a*Math.PI*Math.sin(d.u*2*Math.PI)*.26,5.6);});
      label('altura → movimento',0,3.5);break;
    }
    case 'resonance': {
      const length=4.2*a/30;box(.09,1.1,.7,ink,-length/2,1.3,0);tube([v(-length/2,1.85,-.4),v(length/2,1.85,-.4)],.04,ink);tube([v(-length/2,.75,-.4),v(length/2,.75,-.4)],.04,ink);
      const wave=line(pointsOn(u=>v(-length/2+u*length,1.3+Math.sin((2*b-1)*Math.PI*u/2)*.42,0)),blue);
      dynamic.push(t=>{const p=wave.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,1.3+Math.sin((2*b-1)*Math.PI*i/(p.count-1)/2)*.42*Math.cos(t*2));p.needsUpdate=true;});
      label('fechado',-length/2,2.6).scale.set(1.8,.45,1);label('aberto',length/2,2.6).scale.set(1.8,.45,1);label('deslocamento ampliado',0,.12,1.5);break;
    }
    default: throw new Error(`Unknown portable scene: ${mode}`);
  }
}
