import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { model } from './edu-models.js';

const ink=0x283d36, blue=0x528faf, green=0x668d59, orange=0xd9894b, red=0xbe5d56, cream=0xf3eddd;
const v=(x,y,z=0)=>new THREE.Vector3(x,y,z);

export function createScene(mode, values={a:.7,b:1.2}) {
  const root=new THREE.Group(), dynamic=[], mats=[];
  const material=(color,options={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.06,...options});mats.push(m);return m;};
  const mesh=(geometry,color,x=0,y=0,z=0,options={})=>{const m=new THREE.Mesh(geometry,material(color,options));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const box=(w,h,d,color,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z);
  const sphere=(r,color,x=0,y=0,z=0,options={})=>mesh(new THREE.SphereGeometry(r,32,20),color,x,y,z,options);
  const cylinder=(r,h,color,x=0,y=0,z=0)=>mesh(new THREE.CylinderGeometry(r,r,h,32),color,x,y,z);
  const line=(points,color=ink,width=1)=>{const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,linewidth:width}));root.add(m);return m;};
  const tube=(points,r,color,options={})=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,r,8,false),color,0,0,0,options);
  const label=(text,x,y,z=0,color='#283d36')=>{
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='600 60px Barlow, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,96);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.set(3,.75,1);root.add(sprite);return sprite;
  };
  const arrow=(start,end,color=orange)=>{const d=end.clone().sub(start);const a=new THREE.ArrowHelper(d.clone().normalize(),start,d.length(),color,.22,.12);root.add(a);return a;};
  const pointsOn=(f,n=80)=>Array.from({length:n},(_,i)=>f(i/(n-1)));
  const ring=(r,color,x=0,y=0,z=0)=>mesh(new THREE.TorusGeometry(r,.045,8,80),color,x,y,z);
  const base=box(6.8,.22,4.7,cream,0,-.12,0);base.material.roughness=1;
  for(let i=-3;i<=3;i++){line([v(i,.003,-2.2),v(i,.003,2.2)],0xddd4bd);line([v(-3.2,.003,i*.65),v(3.2,.003,i*.65)],0xddd4bd);}
  const {a,b}=values;
  let result;
  if(!['river','quake'].includes(mode))result=model(mode,a,b);
  switch(mode){
    case 'pendulum': {
      box(4.8,.15,.25,ink,0,3.2,0);box(.14,3.2,.2,ink,-2.35,1.6,0);box(.14,3.2,.2,ink,2.35,1.6,0);
      for(const [i,L] of [a,b].entries()) {const group=new THREE.Group();group.position.set(i?1.2:-1.2,3.13,0);root.add(group);const length=L*1.25;const rod=box(.045,length,.045,ink);root.remove(rod);rod.position.set(0,-length/2,0);group.add(rod);const bob=sphere(.27,i?orange:blue);root.remove(bob);bob.position.set(0,-length,0);group.add(bob);dynamic.push(t=>group.rotation.z=.23*Math.cos(t*Math.sqrt(9.81/L)));label(i?'B':'A',i?1.2:-1.2,.38,1);}
      break;
    }
    case 'prism': {
      const shape=new THREE.Shape();shape.moveTo(-.9,0);shape.lineTo(.9,0);shape.lineTo(0,1.75);shape.closePath();const prism=mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:2,steps:1}),0x8bb7bd,0,.2,-.5,{transparent:true,opacity:.5});
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry),new THREE.LineBasicMaterial({color:ink}));prism.add(edges);
      const entryY=1.1+(a-35)/90;tube([v(-3,entryY+.5,0),v(-.4,entryY,0)],.045,0xfff8dd);
      for(let i=0;i<7;i++){const color=new THREE.Color().setHSL(.78-i*.13,.7,.56);tube([v(-.4,entryY,0),v(.6,.9,0),v(3.1,.5+i*.18*(b/1.5),0)],.025,color);}
      label('luz branca',-2.05,2.1);label('vidro',0,2.5);label('espectro',2.1,2.2);break;
    }
    case 'lens': {
      const d=a/15,f=b/15,image=result.value/15;box(.15,.15,3,ink,0,.25,0);const lens=sphere(.9,0x8dc5cd,0,1.6,0,{transparent:true,opacity:.4});lens.scale.set(.2,1,1);ring(.9,ink,0,1.6,0).rotation.y=Math.PI/2;
      arrow(v(-d,.2,0),v(-d,1.5,0),green);arrow(v(Math.min(image,3),1.3,0),v(Math.min(image,3),.2,0),orange);
      line([v(-d,1.5,0),v(0,1.5,0),v(Math.min(image,3),.2,0)],red);line([v(-d,1.5,0),v(0,1,0),v(Math.min(image,3),.2,0)],blue);sphere(.05,orange,f,1.6,0);label('objeto',-d,.05,1);label('imagem',Math.min(image,3),.05,1);break;
    }
    case 'wave': {
      const speaker=cylinder(.75,.35,ink,-2.55,1.1,0);speaker.rotation.z=Math.PI/2;
      const wave=line(pointsOn(u=>v(-1.9+u*4.8,1.2+Math.sin(u*a/50)*b/130,0)),blue);
      dynamic.push(t=>{const pos=wave.geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,1.2+Math.sin(i/(pos.count-1)*a/50-t*3)*b/130);pos.needsUpdate=true;});
      for(let i=0;i<15;i++){const dot=sphere(.05,orange,-1.8+i*.3,.4,0);dynamic.push(t=>dot.position.x=-1.8+i*.3+Math.sin(i*.6-t*3)*b/500);}
      label('onda ampliada',.5,2.7);break;
    }
    case 'siphon': {
      for(const [x,y,color] of [[-1.5,1.05,blue],[1.5,.25,green]]){cylinder(.72,1.7,0x96b4b4,x,y,0).material.setValues({transparent:true,opacity:.22});cylinder(.65,.8,blue,x,y-.25,0).material.setValues({transparent:true,opacity:.75});}
      const path=[v(-1.5,.7,0),v(-1.5,2.1,0),v(0,2.7,0),v(1.5,2.1,0),v(1.5,.6-a*.4,0)];tube(path,b/70,ink);const curve=new THREE.CatmullRomCurve3(path);
      for(let i=0;i<10;i++){const dot=sphere(.07,blue);dynamic.push(t=>dot.position.copy(curve.getPoint((t*.06*Math.sqrt(a)+i/10)%1)));}label('tubo preenchido',0,3.05);break;
    }
    case 'magnet': {
      box(1.4,.4,.7,red,-.7,.5,0);box(1.4,.4,.7,blue,.7,.5,0);label('N',-.7,.95);label('S',.7,.95);
      for(let i=1;i<7;i++){const h=i*.32;line(pointsOn(u=>v(-1.4+2.8*u,.54+Math.sin(u*Math.PI)*h,Math.sin(u*Math.PI)*.12)),0x6d8774);line(pointsOn(u=>v(-1.4+2.8*u,.52,Math.sin(u*Math.PI)*-h)),0x6d8774);}
      const compass=cylinder(.25,.08,cream,a,.7,b);const needle=box(.42,.06,.08,red,a,.78,b);needle.rotation.y=-result.value;ring(.27,ink,a,.76,b).rotation.x=Math.PI/2;label('bússola',a,1.35,b);break;
    }
    case 'maglev': {
      box(5,.15,.9,ink,0,.22,0);for(let i=0;i<12;i++)box(.22,.15,1,i%2?blue:red,-2.4+i*.43,.38,0);
      const train=box(2.4,.55,.8,cream,0,.75+result.value,0);for(let i=0;i<5;i++)box(.25,.2,.03,blue,-.8+i*.4,train.position.y+.06,.42);label('equilíbrio',0,2.5);arrow(v(0,.6,0),v(0,1.5,0),orange);break;
    }
    case 'brake': {
      const wheel=ring(1,ink,0,1.35,0);const spokes=new THREE.Group();root.add(spokes);spokes.position.copy(wheel.position);for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;const l=line([v(0,0,0),v(Math.cos(angle),Math.sin(angle),0)],0xa1a793);root.remove(l);spokes.add(l);}cylinder(.13,.22,orange,0,1.35,0).rotation.x=Math.PI/2;
      box(.4,.35,.18,red,-.7,1.8,.2);box(.4,.35,.18,red,.7,1.8,.2);dynamic.push(t=>spokes.rotation.z=-Math.min(t,a/(b*9.81))*a+Math.min(t,a/(b*9.81))**2*b*9.81/2);label('roda + freio',0,3);break;
    }
    case 'rocket': {
      const body=cylinder(.65,1.6,cream,0,2,0);mesh(new THREE.ConeGeometry(.65,.65,32),orange,0,3.12,0);mesh(new THREE.CylinderGeometry(.3,.65,.65,32,1,true),ink,0,.9,0);
      for(let i=0;i<60;i++){const dot=sphere(.035,i%2?orange:red);dynamic.push(t=>{const f=(t*b/3500+i/60)%1;dot.position.set(Math.sin(i*3)*f*.5,.65-f*(.5+a/8),Math.cos(i*3)*f*.5);dot.scale.setScalar(1-f*.6);});}arrow(v(1.4,1.3),v(1.4,2.6),green);label('empuxo',1.55,3);break;
    }
    case 'wind': {
      const body=sphere(.65,orange,0,1.2,0);body.scale.set(1.4,.6+b*.4,.7);for(let i=0;i<10;i++){const z=(i-4.5)*.25;line(pointsOn(u=>v(-3+u*6,1.1+(i%3-1)*.6+Math.sin(u*Math.PI)*.3*b,z)),0x90b5b5);const dot=sphere(.05,blue);dynamic.push(t=>{const x=((t*a/10+i*.7)%6)-3;dot.position.set(x,1.1+(i%3-1)*.6+Math.sin((x+3)/6*Math.PI)*.3*b,z);});}label('fluxo ilustrativo',0,2.9);break;
    }
    case 'gears': {
      box(4,.16,.2,ink,0,1.2,0);const wheels=[];for(const x of [-1.8,1.8]){const w=ring(.65,ink,x,1.2,0);w.rotation.y=Math.PI/2;const group=new THREE.Group();group.position.set(x,1.2,0);root.add(group);for(let i=0;i<8;i++){const l=line([v(0,0,0),v(0,Math.cos(i*Math.PI/4)*.65,Math.sin(i*Math.PI/4)*.65)],x<0?blue:orange);root.remove(l);group.add(l);}wheels.push(group);}sphere(.42,green,0,1.2,0);dynamic.push(t=>{wheels[0].rotation.x=t*b*(a-.75)/a;wheels[1].rotation.x=t*b*(a+.75)/a;});label('interna',-1.8,2.3);label('externa',1.8,2.3);break;
    }
    case 'lightning': {
      const cloud=new THREE.Group();root.add(cloud);for(let i=0;i<5;i++){const ball=sphere(.45,0xa5b6b0,(i-2)*.4,2.8+Math.sin(i)*.15,0);}
      const height=.6+b*1.8;for(let j=0;j<5;j++)line(pointsOn(u=>v(Math.sin(u*33+j)*.12*(u+1)+(j-2)*u*.4,2.55-u*height,Math.cos(u*11+j)*.05)),j?0xa6bdd3:orange);
      label('campo médio',0,3.45);arrow(v(2.2,2.6),v(2.2,.5),blue);break;
    }
    case 'mirror': {
      box(.045,2.8,3,0x96b4b4,0,1.5,0).material.setValues({transparent:true,opacity:.3});for(const [x,color] of [[-a,orange],[a,blue]]){box(.5,.9,.5,color,x,.55,b*.5);sphere(.27,color,x,1.25,b*.5);}line([v(-a,.05,b*.5),v(a,.05,b*.5)],ink);label('objeto',-a,2.6,b*.5);label('imagem',a,2.6,b*.5);break;
    }
    case 'skate': {
      box(5,.15,3.6,0xaec4c4,0,.15,0);const boot=box(1.9,.6,.6,ink,0,1.1,0);box(.5,.7,.6,ink,-.6,1.65,0);box(2.2,.13,.05+b*.03,0xd9d5c7,0,.65,0);arrow(v(0,2.9),v(0,1.8),orange);label('força / área',0,3.3);break;
    }
    case 'root': {
      box(3.8,.8,2.4,0xb69a77,0,.42,0);const seed=sphere(.26,orange,0,1.1,0);const angle=a*Math.PI/180;
      const curve=pointsOn(u=>{const bend=angle*Math.exp(-u*b/35);return v(Math.sin(bend)*u*1.55,1.05-u*1.05,1.3);},40);tube(curve,.05,0xe4d4ae);tube(pointsOn(u=>v(-Math.sin(angle*(1-u*b/100))*u,1.15+u*1.65,0),40),.06,green);
      const leaf=sphere(.3,green,-.15,2.3,0);leaf.scale.set(1.7,.3,1);arrow(v(2.5,2.4),v(2.5,.9),blue);label('gravidade',2.3,2.9);label('raiz',.6,.3,1.4);break;
    }
    case 'heart': {
      const core=new THREE.Group();root.add(core);for(const [x,color] of [[-.28,blue],[.28,red]]){const chamber=sphere(.46,color,x,1.4,0);root.remove(chamber);core.add(chamber);}dynamic.push(t=>core.scale.setScalar(1+.05*Math.sin(t*a/60*Math.PI*2)));
      const left=new THREE.CatmullRomCurve3([v(-.25,1.6),v(-1.9,2.55),v(-2.4,1.15),v(-.2,1.1)]),right=new THREE.CatmullRomCurve3([v(.25,1.6),v(1.9,2.55),v(2.4,1.15),v(.2,1.1)]);
      for(const [curve,color] of [[left,blue],[right,red]]){tube(curve.points,.08,color);for(let i=0;i<8;i++){const dot=sphere(.09,color);dynamic.push(t=>dot.position.copy(curve.getPoint((t*a*b/20000+i/8)%1)));}}label('pulmões',-1.9,2.6);label('corpo',1.9,3);label('coração',0,.4);break;
    }
    case 'bird': {
      const body=sphere(.45,green,0,1.5,0);body.scale.set(1.3,.8,.7);sphere(.22,green,.65,1.7,0);const beak=mesh(new THREE.ConeGeometry(.065,.65,12),ink,1.02,1.75,0);beak.rotation.z=-Math.PI/2;
      for(const sign of [-1,1]){const wing=sphere(.55,0x99b0aa,0,1.5,sign*.45);wing.scale.set(.8,.1,2);dynamic.push(t=>{const phase=t*a/50*3;wing.rotation.x=sign*Math.sin(phase)*b*Math.PI/180;wing.rotation.z=Math.sin(phase*2)*.3;});}
      line(pointsOn(u=>v(Math.sin(u*Math.PI*2)*1.2,1.5+Math.sin(u*Math.PI*4)*b/120,1.3)),orange);label('trajetória ampliada',0,3);break;
    }
    case 'bubble': {
      const color=new THREE.Color().setHSL((a/600)%1,.5,.6);const bubble=sphere(b*.16,color,0,1.5,0,{transparent:true,opacity:.65,metalness:.35,roughness:.12});for(let i=0;i<4;i++){const r=ring(b*.16*(.55+i*.12),new THREE.Color().setHSL((a/600+i*.12)%1,.55,.65),0,1.5,0);r.rotation.x=i*.6;r.rotation.y=i*.4;}dynamic.push(t=>bubble.rotation.y=t*.1);label('película de sabão',0,3.2);break;
    }
    case 'crystal': {
      cylinder(2,.3,cream,0,.2,0);const count=Math.round(8*a*(1+b/100)),size=.18+result.value*.9;for(let i=0;i<count;i++){const angle=i*2.39996,r=Math.sqrt(i/count)*1.65;const crystal=mesh(new THREE.OctahedronGeometry(size,0),i%2?blue:0xb2cace,Math.cos(angle)*r,.4+size,Math.sin(angle)*r);crystal.rotation.set(i*.3,i*.5,i*.2);}label('cristais ilustrativos',0,2.7);break;
    }
    case 'fusion': {
      const ring1=ring(1.05,ink,0,1.45,0);ring1.rotation.y=Math.PI/2;ring(1.05,orange,0,1.45,0).rotation.x=Math.PI/2;sphere(.36,orange,0,1.45,0);for(let i=0;i<30;i++){const dot=sphere(.055,i%2?blue:red);dynamic.push(t=>{const angle=t*2+i*2.4,r=.4+(i%7)*.1;dot.position.set(Math.cos(angle)*r,1.45+Math.sin(angle)*r,Math.sin(angle*2)*.3);});}box(.6,a/35,.6,blue,-2,.2+a/70,0);box(.6,a*b/3500,.6,orange,2,.2+a*b/7000,0);label('fornecida',-2,2.8);label('recuperada',2,2.8);break;
    }
    case 'tide': case 'aurora': case 'sky': {
      const earth=sphere(.95,blue,0,1.3,0);for(let i=0;i<10;i++){const land=sphere(.2+(i%3)*.05,green,Math.cos(i*2.4)*.82,1.3+Math.sin(i*2.4)*.55,Math.sin(i)*.6);land.scale.set(1.3,.65,.7);}dynamic.push(t=>earth.rotation.y=t*.035);
      if(mode==='tide'){const water=sphere(1.04,0x8ec6cf,0,1.3,0,{transparent:true,opacity:.24});water.scale.set(1+result.value*.18,1,1);water.rotation.z=a*Math.PI/180;const angle=a*Math.PI/180;sphere(.25,0xd4c8b1,Math.cos(angle)*2.4,1.3+Math.sin(angle)*1.3,0);sphere(.4,orange,-2.7,1.3,0);label('maré de equilíbrio',0,3.2);}
      if(mode==='aurora'){for(let j=0;j<3;j++){const r=ring(.4+a/280,j===0?green:j===1?0x9f729b:0x86ad70,0,2.25-j*.08,0);r.rotation.x=Math.PI/2;r.material.setValues({transparent:true,opacity:.5+b/250});}for(let i=0;i<40;i++){const dot=sphere(.027,orange);dynamic.push(t=>{const angle=i*.83+t*.25;dot.position.set(Math.cos(angle)*(.35+a/260),2.1+Math.sin(angle*2)*.25*(b/100),Math.sin(angle)*(.35+a/260));});}label('polos magnéticos',0,3.1);}
      if(mode==='sky'){const atmosphere=sphere(1.12,0x98bad3,0,1.3,0,{transparent:true,opacity:.15+b/500});const angle=a*Math.PI/180;const sun=sphere(.4,orange,Math.cos(angle)*2.4,1.3+Math.sin(angle)*1.8,0);line([sun.position,v(-.8,1.2,0)],orange);label('caminho da luz',0,3.4);}
      break;
    }
    case 'flood': {
      box(6,.5,3.8,0xa9ad89,0,.25,0);for(let i=0;i<12;i++){const x=-2+(i%4)*1.3,z=-1.4+Math.floor(i/4)*1.2,h=b+(i%4)*.45+Math.floor(i/4)*.2;box(.7,h*.25+.3,.6,cream,x,.5+(h*.25+.3)/2,z);const roof=mesh(new THREE.ConeGeometry(.6,.4,4),a>h?red:orange,x,.5+h*.25+.5,z);roof.rotation.y=Math.PI/4;}
      box(6.2,Math.max(.01,a*.25),4,blue,0,.5+a*.125,0).material.setValues({transparent:true,opacity:.65});label('cidade fictícia',0,3.3);break;
    }
    case 'terrain': {
      const h=a/400;for(let i=0;i<Math.max(1,result.value);i++){const ratio=1-i/Math.max(1,result.value);const disk=cylinder(2.5*ratio+.15,h/Math.max(1,result.value),i%2?green:0x83916c,0,(i+.5)*h/Math.max(1,result.value),0);const contour=ring(2.5*ratio+.15,ink,0,(i+1)*h/Math.max(1,result.value)+.01,0);contour.rotation.x=Math.PI/2;}label('curvas de nível',0,h+.6);break;
    }
    case 'graph': {
      const coords=Array.from({length:8},(_,i)=>v((i&1)?1:-1,(i&2)?2.6:.6,(i&4)?1:-1));for(let i=0;i<8;i++){sphere(.12,i===a?orange:i===b?red:ink,...coords[i].toArray());label(String(i),coords[i].x,coords[i].y+.25,coords[i].z);for(let bit=0;bit<3;bit++)if(!(i&(1<<bit)))line([coords[i],coords[i|(1<<bit)]],0x97aea2);}
      let current=a;for(let bit=0;bit<3;bit++)if((current^b)&(1<<bit)){const next=current^(1<<bit);tube([coords[current],coords[next]],.035,orange);current=next;}break;
    }
    case 'scale': {
      for(const [x,side,color] of [[-1.7,a,blue],[1.7,b,orange]]){const size=side*.6;const cube=box(size,size,size,color,x,size/2,0);cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry),new THREE.LineBasicMaterial({color:ink})));label(x<0?'A':'B',x,3.2);}break;
    }
    case 'network': {
      const positions=[v(-2.7,.6,0),...Array.from({length:b},(_,i)=>v(-2.1+i*4.2/Math.max(1,b-1),.65+(i%2)*.7,.5*(i%2))),v(2.7,.7,0)];for(let i=0;i<positions.length;i++){const pos=positions[i];box(.3,.5,.4,i===0?green:i===positions.length-1?orange:ink,pos.x,pos.y,pos.z);if(i)line([positions[i-1],pos],0x92a59a);}const curve=new THREE.CatmullRomCurve3(positions);const packet=sphere(.12,orange);dynamic.push(t=>packet.position.copy(curve.getPoint((t/Math.max(.5,result.value/100))%1)));label('dispositivo',-2.4,2.5);label('servidor',2.4,2.5);break;
    }
    case 'tokens': {
      for(let i=0;i<a;i++){const tile=box(.38,.16,.45,i%3?blue:orange,-2.4+(i%12)*.43,.25+Math.floor(i/12)*.25,0);dynamic.push(t=>tile.material.color.setHex(i<Math.floor(t*b)% (a+1)?green:i%3?blue:orange));}label('peças de texto',0,2.65);break;
    }
    case 'datacenter': {
      for(let i=0;i<a;i++){const x=-2.6+(i%8)*.74,z=-1.5+Math.floor(i/8)*1;box(.5,1.4,.6,ink,x,.75,z);for(let j=0;j<4;j++){box(.32,.15,.03,0x657b73,x,.3+j*.27,z+.32);sphere(.025,j===0?orange:green,x+.12,.3+j*.27,z+.34);}}
      for(let i=0;i<20;i++){const dot=sphere(.04,orange);dynamic.push(t=>dot.position.set(Math.sin(i*4)*2.5,.2+((t*b/800+i*.13)%2.7),Math.cos(i*4)*1.5));}label('energia → calor',0,3.1);break;
    }
    case 'energy': {
      box(1.3,1.9,.8,cream,-1.5,1,0);box(.9,1,.03,blue,-1.5,1.3,.43);box(.9,.3,.03,ink,-1.5,.55,.43);const bar=box(.85,.1+result.value/8,.85,orange,1.5,.15+result.value/16,0);label('aparelho',-1.5,2.8);label('energia acumulada',1.3,3.4);break;
    }
    case 'traffic': {
      box(6,.05,1.6,0x889087,0,.18,0);for(let i=0;i<9;i++)box(.3,.01,.05,cream,-2.7+i*.65,.22,0);cylinder(.07,2,ink,1.5,1.2,-1);box(.35,.8,.3,ink,1.5,2.15,-1);const light=sphere(.1,green,1.5,2.32,-.83);
      for(let i=0;i<Math.min(12,Math.ceil(a/2));i++){const car=box(.5,.2,.35,i%2?blue:orange,0,.37,.4);dynamic.push(t=>{const greenOn=(t%5)/5<b/100;light.material.color.setHex(greenOn?green:red);car.position.x=greenOn?((t*.7+i*.65)%6)-3:-1.3-i*.15;});}label('fluxo médio',0,3.3);break;
    }
    case 'robots': {
      for(let i=0;i<6;i++)box(.4,.7,.5,cream,-2.5+i*1,.4,-1.4);for(let i=0;i<a;i++){const bot=cylinder(.25,.3,i%2?blue:orange,0,.2,0);dynamic.push(t=>{const f=(t/b+i/a)%1;bot.position.set(-2.4+f*4.8,.24,Math.sin(f*Math.PI*2+i)*.9);});}label('divisão ideal de tarefas',0,2.8);break;
    }
    case 'color': {
      const redLight=sphere(.95,0xff6155,-.65,1.35,0,{transparent:true,opacity:a/130});const blueLight=sphere(.95,0x5674e1,.65,1.35,0,{transparent:true,opacity:b/130});const mix=new THREE.Color(a/100,0,b/100);sphere(.4,mix,0,1.35,.8);label('vermelho',-1.8,2.8);label('azul',1.8,2.8);label('mistura aditiva',0,.3,1.4);break;
    }
    case 'room': {
      box(5,.1,3.5,0xc8b993,0,.15,0);box(5,2.8,.1,cream,0,1.6,-1.7);box(.1,2.8,3.5,cream,-2.5,1.6,0);box(2.4,.4,1,green,-.8,.5,-.6);box(2.4,.7,.3,green,-.8,1.05,-1.02);box(.8,.6,.8,orange,1.1,.5,.4);cylinder(.04,1.5,ink,1.8,1,-1);const shade=mesh(new THREE.ConeGeometry(.45,.4,32,1,true),a<4500?0xf3c889:0xe1eaf2,1.8,1.9,-1);
      const light=new THREE.PointLight(a<4500?0xffd2a0:0xd5e7ff,b/15,7,1.5);light.position.set(1.8,1.8,-1);root.add(light);label('composição de luz',0,3.4);break;
    }
    case 'architecture': {
      const r=1.2+a/40;ring(r,ink,0,.25,0).rotation.x=Math.PI/2;cylinder(r-.4,.1,0xa0b090,0,.15,0);for(let i=0;i<b;i++){const angle=i/b*Math.PI*2;const building=box(.48,.8,.6,i%3?cream:orange,Math.cos(angle)*r,.6,Math.sin(angle)*r);building.rotation.y=-angle;sphere(.14,green,Math.cos(angle)*(r-.4),.3,Math.sin(angle)*(r-.4));}label('pátio circular',0,2.7);break;
    }
    case 'orbital': {
      sphere(.9,blue,0,1.4,0);const radius=1.4+a/2000;const orbit=ring(radius,ink,0,1.4,0);orbit.rotation.x=Math.PI/2;
      for(let i=0;i<b;i++){const sat=box(.14,.12,.16,cream);const panel=box(.42,.015,.18,blue);root.remove(panel);sat.add(panel);dynamic.push(t=>{const angle=t*4/result.value+i/b*Math.PI*2;sat.position.set(Math.cos(angle)*radius,1.4,Math.sin(angle)*radius);sat.rotation.y=-angle;});}label('constelação fictícia',0,3.1);break;
    }
    case 'convection': {
      box(5,.1,3,cream,0,.15,0);box(5,2.8,.1,cream,0,1.6,-1.5);box(.1,2.8,3,cream,-2.5,1.6,0);box(.06,1.4,1,blue,-2.43,1.5,0).material.setValues({transparent:true,opacity:.4});box(.5,.7,1,orange,-1.9,.55,0);
      const loop=new THREE.CatmullRomCurve3([v(-1.8,.6,.5),v(-1.8,2.3,.5),v(1.8,2.3,.5),v(1.8,.45,.5),v(-1.8,.6,.5)]);tube(loop.points,.03,0xa4b6a3);for(let i=0;i<24;i++){const dot=sphere(.06,i<12?orange:blue);dynamic.push(t=>{const u=(t*(a-20)/250+i/24)%1;dot.position.copy(loop.getPoint(u));dot.material.color.setHex(u<.5?orange:blue);});}
      if(b>0)arrow(v(-2.5,1,.7),v(-2.5+b/75,1,.7),blue);label('correntes ilustrativas',0,3.4);break;
    }
    case 'pipeline': {
      const positions=[v(-2.3,.8,0),v(0,.8,0),v(2.3,.8,0)];for(const [i,p] of positions.entries()){box(.8,1,.65,i===1?ink:cream,p.x,p.y,p.z);box(.55,.45,.03,i===1?green:blue,p.x,p.y+.1,.35);}const curve=new THREE.CatmullRomCurve3(positions);tube(positions,.035,0x9da890);for(let i=0;i<12;i++){const token=sphere(.07,orange);dynamic.push(t=>token.position.copy(curve.getPoint((t/result.value+i/12)%1)));}label('entrada',-2.3,2.4);label('processamento',0,2.4);label('saída',2.3,2.4);break;
    }
    case 'conversation': {
      const scale=b/250;for(let i=0;i<a;i++){const x=-2.7+(i%10)*.57,z=-.9+Math.floor(i/10)*1.2;const h=.1+(i+1)*scale*.06;box(.38,h,.45,blue,x,h/2+.1,z);box(.38,scale*.06,.45,orange,x,scale*.03+.1,z+.52);}label('entradas crescem',-.9,3.1);label('saídas iguais',1.4,3.1);break;
    }
    case 'river': {
      box(5.8,.4,3.6,green,0,.15,0);const pts=pointsOn(u=>v(-3+u*6,.4,Math.sin(u*Math.PI*2)*.8));tube(pts,.28,blue);for(let i=0;i<28;i++){const x=Math.sin(i*4)*2.6,z=Math.cos(i*2.8)*1.6;if(Math.abs(z-Math.sin((x+3)/6*Math.PI*2)*.8)>.5){cylinder(.035,.35,ink,x,.6,z);sphere(.16,0x4b7053,x,.85,z);}}label('água transforma paisagens',0,2.6);break;
    }
    case 'quake': {
      for(const [x,h] of [[-1.3,2.4],[1.3,1.4]]){box(1,.15,.8,ink,x,.25,0);for(let i=0;i<Math.floor(h/.3);i++){box(.8,.15,.7,i%2?cream:blue,x,.5+i*.3,0);}label(x<0?'torre A':'torre B',x,3.1);}break;
    }
  }
  return { root, update:time=>dynamic.forEach(fn=>fn(time)), dispose:()=>{root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});} };
}

export function makeRenderer(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(window.devicePixelRatio || 1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf1ebdc);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  return renderer;
}
export function makeWorld() {
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff8e6,0x7b9189,2.2));
  const sun=new THREE.DirectionalLight(0xffefd8,3);sun.position.set(-3,8,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.035;scene.add(sun);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(6,4.8,7.6);camera.zoom=1.13;camera.lookAt(0,1,0);camera.updateProjectionMatrix();return {scene,camera};
}
export function mountLab(canvas,mode,values) {
  const renderer=makeRenderer(canvas),{scene,camera}=makeWorld();let content=createScene(mode,values);scene.add(content.root);
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,1,0);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false;
  const resize=()=>{const rect=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  let playing=false,time=0,previous=performance.now(),frames=0;
  renderer.setAnimationLoop(now=>{if(playing)time+=Math.min(.05,(now-previous)/1000);previous=now;controls.update();content.update(time);renderer.render(scene,camera);frames++;});
  return {
    setValues(next){scene.remove(content.root);content.dispose();content=createScene(mode,next);scene.add(content.root);time=0;},
    play(value){playing=value;},advance(seconds){time+=seconds;content.update(time);renderer.render(scene,camera);},reset(){time=0;playing=false;controls.reset();},
    observe(){const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {time,playing,frames,camera:camera.position.toArray(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};},
    dispose(){renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();content.dispose();renderer.dispose();},
  };
}
export async function renderPreviews(lessons,onPreview) {
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=450;let renderer;
  try{renderer=makeRenderer(canvas);}catch{return;}
  renderer.setPixelRatio(1);renderer.setSize(720,450,false);const {scene,camera}=makeWorld();camera.aspect=720/450;camera.updateProjectionMatrix();
  for(const lesson of lessons){const values=Object.fromEntries(lesson.controls.map(c=>[c.id,c.value]));const content=createScene(lesson.mode,values);scene.add(content.root);content.update(.5);renderer.render(scene,camera);onPreview(lesson,canvas.toDataURL('image/webp',.9));scene.remove(content.root);content.dispose();await new Promise(r=>requestAnimationFrame(r));}
  renderer.dispose();
}
