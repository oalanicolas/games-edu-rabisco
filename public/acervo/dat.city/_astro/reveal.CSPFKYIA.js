import{a as X,Y as pe,x as ne,E as k,N as Re,O as ye,Z as Me,_ as ze,$ as we,a0 as se,K as j,a1 as W,e as N,V as H,a2 as Ae,a3 as Ce,g as Se,h as $,z as Y,f as xe,w as be,y as Pe,I as le,v as Te,q as ee,a4 as D,L as ue}from"./config.DkDxwQJL.js";import{c as te,e as De}from"./utils.C9s8-uzD.js";const K=new Map;let ie=0;typeof window<"u"&&(window.__roadPaths=K);function ge(e,a){return[String(e),String(a)].sort().join("::")}function Qe(){K.clear(),ie+=1}function et(e,a,i,n="road"){!Array.isArray(i)||i.length<2||(K.set(ge(e,a),{points:i.map(t=>({x:t.x,z:t.z})),kind:n}),ie+=1)}function Ie(e,a){return K.get(ge(e,a))||null}function Fe(){return[...K.entries()].map(([e,a])=>({key:e,kind:a.kind,points:a.points}))}function J(){return ie}const Ee=0,ae=1,V=64,_e=5,Oe=1.5,Be=.9,ce=24e3;function We(e,a,i={}){const n=Number.isFinite(i.floorY)?i.floorY:0,t=i.districts||[...a.districts,...a.futureDistricts||[]],r=new Map(t.map(c=>[c.id,c])),l=c=>[c[0],c[1]].sort().join("::"),f=(a.bridges||[]).filter(c=>r.has(c[0])&&r.has(c[1])),o=new Set(f.map(l)),s=(a.routes||[]).filter(c=>r.has(c[0])&&r.has(c[1])&&!o.has(l(c))),m=new Set(s.map(l));for(const c of a.streetConnections||[]){if(!r.has(c[0])||!r.has(c[1]))continue;const R=l(c);o.has(R)||m.has(R)||(m.add(R),s.push(c))}const v=t.map(c=>({id:c.id,x:c.x,z:c.z,clearance:(c.radius||c.r||24)*1.16+3,ring:(c.radius||c.r||24)*1.04})),p=(c,R,F,_)=>{const P=r.get(c[0]),E=r.get(c[1]),G=Ie(P.id,E.id);if(G)return de(P,E,R,n,G.points,0);if(F){const w=Le(F,P,E);if(w){const T=l(c);return _.has(T)||_.set(T,(_.size%7-3)*.45),de(P,E,R,n,w,_.get(T))}}return Ne(P,E,R,n,v,u?1:0)},x=new Map;let u=!1;const h=()=>{const c=Ge(Fe());return[...f.map(R=>p(R,ae,c,x)),...s.map(R=>p(R,Ee,c,x))].filter(Boolean)};let g=h(),d=J(),A=fe(g);const C=new X(0,0),y={uPixelRatio:{value:Math.min(window.devicePixelRatio||1,2)},uTime:{value:0},uModeMix:{value:0},uDistanceFade:{value:1},uPathTexture:{value:A},uPathTextureSize:{value:new X(V,Math.max(1,g.length))},uRevealActive:{value:0},uRevealCenter:{value:C},uRevealRadius:{value:0},uRevealFeather:{value:18},uRevealDataInside:{value:1},uSizeBoost:{value:1}},S=new pe(ve(g),new ne({transparent:!0,depthWrite:!1,blending:k,toneMapped:!1,uniforms:y,vertexShader:`
        uniform float uPixelRatio;
        uniform float uTime;
        uniform float uModeMix;
        uniform float uDistanceFade;
        uniform float uSizeBoost;
        uniform sampler2D uPathTexture;
        uniform vec2 uPathTextureSize;
        attribute float aOpacity;
        attribute float aKind;
        attribute vec3 aColorA;
        attribute vec3 aColorB;
        varying float vAlpha;
        varying vec3 vColor;
        varying vec2 vRevealWorldXZ;
        void main() {
          float lineIndex = position.x;
          float initialU = position.y;
          float pointSpeed = position.z;
          float rowV = (lineIndex + 0.5) / uPathTextureSize.y;
          float lineSpeed = texture2D(uPathTexture, vec2(0.5 / uPathTextureSize.x, rowV)).w;
          float u = fract(initialU + lineSpeed * pointSpeed * uTime);
          float fNode = u * (uPathTextureSize.x - 1.0);
          float node0 = floor(fNode);
          vec3 p0 = texture2D(uPathTexture, vec2((node0 + 0.5) / uPathTextureSize.x, rowV)).xyz;
          vec3 p1 = texture2D(uPathTexture, vec2((node0 + 1.5) / uPathTextureSize.x, rowV)).xyz;
          vec3 p = mix(p0, p1, fract(fNode));
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float bridge = step(0.5, aKind);
          gl_PointSize = mix(3.4, 4.6, bridge) * uSizeBoost * uPixelRatio * (540.0 / max(120.0, -mvPosition.z));
          vAlpha = aOpacity * mix(1.0, 1.5, bridge) * uModeMix * uDistanceFade;
          vColor = mix(aColorA, aColorB, u);
          vRevealWorldXZ = p.xz;
        }
      `,fragmentShader:`
        uniform float uRevealActive;
        uniform vec2 uRevealCenter;
        uniform float uRevealRadius;
        uniform float uRevealFeather;
        uniform float uRevealDataInside;
        varying float vAlpha;
        varying vec3 vColor;
        varying vec2 vRevealWorldXZ;
        void main() {
          vec2 uvCentral = gl_PointCoord * 2.0 - 1.0;
          float d = max(length(uvCentral), 1e-4);
          float glow = 0.08 / d;
          glow *= smoothstep(1.0, 0.65, d);
          float alpha = min(1.0, glow) * vAlpha;
          if (uRevealActive > 0.5) {
            float revealDist = distance(vRevealWorldXZ, uRevealCenter);
            float revealEdge = smoothstep(uRevealRadius - uRevealFeather, uRevealRadius + uRevealFeather, revealDist);
            alpha *= mix(revealEdge, 1.0 - revealEdge, uRevealDataInside);
          }
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(min(vec3(10.0), vColor * glow * 1.8), alpha);
        }
      `}));S.name="DataViewConnections",S.frustumCulled=!1,S.renderOrder=1,S.visible=!1,e.add(S);const M=new Re(he(g),new ye({vertexColors:!0,transparent:!0,opacity:0,depthWrite:!1,blending:k,toneMapped:!1}));M.name="DataViewConnectionThreads",M.frustumCulled=!1,M.renderOrder=1,M.visible=!1,e.add(M);let b=-1/0;const z=()=>{g=h();const c=fe(g);A.dispose(),A=c,y.uPathTexture.value=c,y.uPathTextureSize.value.set(V,Math.max(1,g.length)),S.geometry.dispose(),S.geometry=ve(g),M.geometry.dispose(),M.geometry=he(g)},I=()=>{J()!==d&&(d=J(),z())};let O=0;return{lineMaterial:M.material,setVisible(c){S.visible=!!c,M.visible=!!c,S.visible&&I()},setOverlay(c,R=0){O=c?2.2:0,S.position.y=c?R:0,M.position.y=c?R:0,S.material.depthTest=!c,M.material.depthTest=!c,S.renderOrder=c?30:1,M.renderOrder=c?30:1,y.uSizeBoost.value=c?1.4:1,u!==!!c&&(u=!!c,z())},update(c,R,F){const _=Math.max(R,O);y.uTime.value=c,y.uPixelRatio.value=Math.min(window.devicePixelRatio||1,2),y.uModeMix.value=_,y.uDistanceFade.value=F,M.material.opacity=Math.max(.08*R,.19*O)*F,S.visible&&c-b>1&&(b=c,I())},setRevealMask(c){y.uRevealActive.value=c.active?1:0,C.copy(c.center),y.uRevealRadius.value=c.radius,y.uRevealFeather.value=c.feather,y.uRevealDataInside.value=c.dataInside?1:0},dispose(){e.remove(S,M),S.geometry.dispose(),S.material.dispose(),A.dispose(),M.geometry.dispose(),M.material.dispose()}}}function Ne(e,a,i,n,t,r=0){const l=e.radius||e.r||24,f=a.radius||a.r||24,o=a.x-e.x,s=a.z-e.z,m=Math.hypot(o,s);if(!(m>1))return null;const v=n+.9,p=Math.min(.42,l*.9/m),x=1-Math.min(.42,f*.9/m),u=new H(e.x+o*p,v,e.z+s*p),h=new H(e.x+o*x,v,e.z+s*x),g=t.filter(b=>b.id!==e.id&&b.id!==a.id),d=[u,...oe(u,h,g,0),h],C=(d.length>2?new Ae(d,!1,"centripetal",.5):new Ce(u,h)).getSpacedPoints(V-1);if(ke(C,g,u,h),r>0){const b=Math.min(10+Math.hypot(a.x-e.x,a.z-e.z)*.055,26)*r;for(let z=0;z<C.length;z+=1){const I=z/(C.length-1);C[z].y=v+Math.sin(I*Math.PI)*b}}let y=0;for(let b=1;b<C.length;b+=1)y+=C[b].distanceTo(C[b-1]);const S=new N(e.accent||(e.future?"#45ff9d":"#36ecff")),M=new N(a.accent||(a.future?"#45ff9d":"#36ecff"));return{nodes:C,length:y,colorA:S,colorB:M,kind:i}}function de(e,a,i,n,t,r){const l=Xe(Ve(t,r),n+.9);if(!l)return null;let f=0;for(let o=1;o<l.length;o+=1)f+=l[o].distanceTo(l[o-1]);return{nodes:l,length:f,colorA:new N(e.accent||(e.future?"#45ff9d":"#36ecff")),colorB:new N(a.accent||(a.future?"#45ff9d":"#36ecff")),kind:i}}function Ve(e,a){return a?e.map((i,n)=>{const t=e[Math.max(0,n-1)],r=e[Math.min(e.length-1,n+1)],l=r.x-t.x,f=r.z-t.z,o=Math.hypot(l,f)||1;return{x:i.x+-f/o*a,z:i.z+l/o*a}}):e}function Ge(e){if(!e.length)return null;const a=o=>`${Math.round(o.x*2)},${Math.round(o.z*2)}`,i=(o,s,m,v)=>{const p=s.x-o.x,x=s.z-o.z,u=v.x-m.x,h=v.z-m.z,g=p*h-x*u;if(Math.abs(g)<1e-9)return null;const d=((m.x-o.x)*h-(m.z-o.z)*u)/g,A=((m.x-o.x)*x-(m.z-o.z)*p)/g;return d<0||d>1||A<0||A>1?null:{t:d,x:o.x+p*d,z:o.z+x*d}},n=e.map(o=>o.points.map(s=>({x:s.x,z:s.z}))),t=n.map(o=>o.map(()=>[]));for(let o=0;o<n.length;o+=1)for(let s=o+1;s<n.length;s+=1)for(let m=0;m<n[o].length-1;m+=1)for(let v=0;v<n[s].length-1;v+=1){const p=i(n[o][m],n[o][m+1],n[s][v],n[s][v+1]);if(!p)continue;t[o][m].push({t:p.t,x:p.x,z:p.z});const x=i(n[s][v],n[s][v+1],n[o][m],n[o][m+1]);x&&t[s][v].push({t:x.t,x:x.x,z:x.z})}const r=new Map,l=o=>{const s=a(o);return r.has(s)||r.set(s,{key:s,x:o.x,z:o.z,edges:[]}),r.get(s)},f=(o,s)=>{if(o.key===s.key)return;const m=Math.hypot(o.x-s.x,o.z-s.z);o.edges.push({to:s.key,weight:m}),s.edges.push({to:o.key,weight:m})};return e.forEach((o,s)=>{let m=null;n[s].forEach((v,p)=>{const x=[v,...t[s][p].sort((u,h)=>u.t-h.t)];for(const u of x){const h=l(u);m&&f(m,h),m=h}})}),r}function Le(e,a,i){if(!e)return null;const n=(a.radius||a.r||24)*1.2+16,t=(i.radius||i.r||24)*1.2+16,r=[],l=new Set;for(const u of e.values()){const h=Math.hypot(u.x-a.x,u.z-a.z),g=Math.hypot(u.x-i.x,u.z-i.z);h<n&&r.push({key:u.key,cost:h*.5}),g<t&&l.add(u.key)}if(!r.length||!l.size)return null;const f=new Map,o=new Map,s=[...r];for(const u of s)f.set(u.key,u.cost);let m=null;for(;s.length;){let u=0;for(let d=1;d<s.length;d+=1)s[d].cost<s[u].cost&&(u=d);const h=s.splice(u,1)[0];if(h.cost>(f.get(h.key)??1/0))continue;if(l.has(h.key)){m=h.key;break}const g=e.get(h.key);for(const d of g.edges){const A=h.cost+d.weight;A<(f.get(d.to)??1/0)&&(f.set(d.to,A),o.set(d.to,h.key),s.push({key:d.to,cost:A}))}}if(!m)return null;const v=[];for(let u=m;u!==void 0;u=o.get(u)){const h=e.get(u);v.push({x:h.x,z:h.z})}if(v.reverse(),v.length<2)return null;let p=0;for(let u=1;u<v.length;u+=1)p+=Math.hypot(v[u].x-v[u-1].x,v[u].z-v[u-1].z);const x=Math.hypot(i.x-a.x,i.z-a.z);return p>Math.max(x*2.4,x+170)?null:v}function Xe(e,a){if(!Array.isArray(e)||e.length<2)return null;const i=[0];for(let l=1;l<e.length;l+=1)i.push(i[l-1]+Math.hypot(e[l].x-e[l-1].x,e[l].z-e[l-1].z));const n=i[i.length-1];if(!(n>1))return null;const t=[];let r=0;for(let l=0;l<V;l+=1){const f=n*l/(V-1);for(;r<e.length-2&&i[r+1]<f;)r+=1;const o=Math.max(i[r+1]-i[r],1e-6),s=Math.min(Math.max((f-i[r])/o,0),1);t.push(new H(e[r].x+(e[r+1].x-e[r].x)*s,a,e[r].z+(e[r+1].z-e[r].z)*s))}return t}function ke(e,a,i,n){const t=[];for(const r of a){const l=Math.min(Math.hypot(i.x-r.x,i.z-r.z),Math.hypot(n.x-r.x,n.z-r.z)),f=Math.min(r.clearance,l*.98);f>r.ring&&t.push({x:r.x,z:r.z,radius:f})}if(t.length)for(let r=0;r<4;r+=1){let l=!1;for(let f=1;f<e.length-1;f+=1){const o=e[f],s=t.filter(p=>Math.hypot(o.x-p.x,o.z-p.z)<p.radius);if(!s.length)continue;if(l=!0,s.length>=2){Ze(o,s[0],s[1]);continue}const m=s[0],v=Math.max(.001,Math.hypot(o.x-m.x,o.z-m.z));o.x=m.x+(o.x-m.x)/v*m.radius,o.z=m.z+(o.z-m.z)/v*m.radius}if(!l)return}}function Ze(e,a,i){const n=i.x-a.x,t=i.z-a.z,r=Math.hypot(n,t);if(r<.001||r>=a.radius+i.radius)return;const l=(r*r+a.radius*a.radius-i.radius*i.radius)/(2*r),f=a.radius*a.radius-l*l;if(f<=0)return;const o=Math.sqrt(f),s=a.x+n/r*l,m=a.z+t/r*l,v=-t/r*o,p=n/r*o,x=[{x:s+v,z:m+p},{x:s-v,z:m-p}],u=Math.hypot(e.x-x[0].x,e.z-x[0].z)<=Math.hypot(e.x-x[1].x,e.z-x[1].z)?x[0]:x[1];e.x=u.x,e.z=u.z}function oe(e,a,i,n){if(n>=_e)return[];const t=a.x-e.x,r=a.z-e.z,l=t*t+r*r;if(l<1)return[];let f=null,o=0,s=0;for(const g of i){const d=((g.x-e.x)*t+(g.z-e.z)*r)/l;if(d<=.02||d>=.98)continue;const A=e.x+t*d,C=e.z+r*d,y=Math.hypot(g.x-A,g.z-C),S=g.clearance-y;S>o&&(f=g,o=S,s=d)}if(!f)return[];const m=e.x+t*s,v=e.z+r*s;let p=m-f.x,x=v-f.z,u=Math.hypot(p,x);u<.001&&(p=-r,x=t,u=Math.sqrt(l));const h=new H(f.x+p/u*f.clearance*1.06,e.y,f.z+x/u*f.clearance*1.06);for(let g=0;g<3;g+=1){const d=i.find(C=>Math.hypot(h.x-C.x,h.z-C.z)<C.clearance);if(!d)break;const A=Math.max(.001,Math.hypot(h.x-d.x,h.z-d.z));h.x=d.x+(h.x-d.x)/A*d.clearance*1.06,h.z=d.z+(h.z-d.z)/A*d.clearance*1.06}return[...oe(e,h,i,n+1),h,...oe(h,a,i,n+1)]}function fe(e){const a=Math.max(1,e.length),i=new Float32Array(V*a*4),n=e.reduce((r,l)=>Math.max(r,l.length),1);e.forEach((r,l)=>{for(let f=0;f<V;f+=1){const o=(l*V+f)*4;i[o]=r.nodes[f].x,i[o+1]=r.nodes[f].y,i[o+2]=r.nodes[f].z,i[o+3]=n/r.length}});const t=new Me(i,V,a,ze,we);return t.magFilter=se,t.minFilter=se,t.needsUpdate=!0,t}function ve(e){const a=e.reduce((x,u)=>Math.max(x,u.length),1),i=22/a,n=30/a;let t=0;const r=e.map(x=>{const u=x.kind===ae?Be:Oe,h=Math.max(12,Math.round(x.length/u));return t+=h,h}),l=t>ce?ce/t:1,f=[],o=[],s=[],m=[],v=[];e.forEach((x,u)=>{const h=Math.max(8,Math.round(r[u]*l)),g=x.kind===ae?n:i;for(let d=0;d<h;d+=1)f.push(u,Math.random(),(.1+Math.random())*g),o.push(.1+Math.random()*.45),s.push(x.kind),m.push(x.colorA.r,x.colorA.g,x.colorA.b),v.push(x.colorB.r,x.colorB.g,x.colorB.b)});const p=new j;return p.setAttribute("position",new W(f,3)),p.setAttribute("aOpacity",new W(o,1)),p.setAttribute("aKind",new W(s,1)),p.setAttribute("aColorA",new W(m,3)),p.setAttribute("aColorB",new W(v,3)),p}function he(e){const a=[],i=[],n=new N;for(const r of e)for(let l=0;l<r.nodes.length-1;l+=1){const f=r.nodes[l],o=r.nodes[l+1];a.push(f.x,f.y,f.z,o.x,o.y,o.z),n.copy(r.colorA).lerp(r.colorB,l/(r.nodes.length-1)),i.push(n.r,n.g,n.b),n.copy(r.colorA).lerp(r.colorB,(l+1)/(r.nodes.length-1)),i.push(n.r,n.g,n.b)}const t=new j;return t.setAttribute("position",new W(a,3)),t.setAttribute("color",new W(i,3)),t}const Ue=.035,Ke=.5,Ye=340,qe=520;function tt(e,a,i={}){const n=a.bounds||520,t=ee.water+.18,r=Number.isFinite(i.dotSizeScale)?i.dotSizeScale:1,l=Number.isFinite(i.dotAlphaScale)?i.dotAlphaScale:1,f=Number.isFinite(i.spacing)?i.spacing:void 0,o=Number.isFinite(i.floorOpacity)?i.floorOpacity:.94,s=Number.isFinite(i.ringOpacity)?i.ringOpacity:.5,m=new X(99999,99999),v=new X(99999,99999);let p=0,x=0,u=0,h=0,g=!1;const d={active:!1,center:new X(0,0),radius:0,feather:18,dataInside:!0},A=[...a.districts,...a.futureDistricts||[]],C=Math.max(700,n*1.45),y=new Se(C*2.15,C*2.15,1,1),S=new $({color:132875,transparent:!0,opacity:0,depthWrite:!1,toneMapped:!1,side:Y});Q(S,d);const M=new xe(y,S);M.rotation.x=-Math.PI/2,M.position.y=t-.08,M.name="DataViewFloor",M.renderOrder=-2,M.frustumCulled=!1,M.visible=!1,e.add(M);const b=He(n,t,A,{dotAlphaScale:l,dotSizeScale:r,spacing:f}),z=new pe(b,new ne({transparent:!0,depthWrite:!1,blending:k,toneMapped:!1,uniforms:{uPixelRatio:{value:Math.min(window.devicePixelRatio||1,2)},uTime:{value:0},uCursorCenter:{value:v.clone()},uCursorStrength:{value:0},uModeMix:{value:0},uDistanceFade:{value:1},uRevealActive:{value:0},uRevealCenter:{value:d.center.clone()},uRevealRadius:{value:0},uRevealFeather:{value:18},uRevealDataInside:{value:1}},vertexShader:`
        uniform float uPixelRatio;
        uniform float uTime;
        uniform vec2 uCursorCenter;
        uniform float uCursorStrength;
        uniform float uModeMix;
        uniform float uDistanceFade;
        uniform float uRevealActive;
        uniform vec2 uRevealCenter;
        uniform float uRevealRadius;
        uniform float uRevealFeather;
        uniform float uRevealDataInside;
        attribute float aAlpha;
        attribute float aSize;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        varying vec2 vRevealWorldXZ;
        void main() {
          vec3 p = position;
          float dist = distance(p.xz, uCursorCenter);
          float falloff = smoothstep(78.0, 0.0, dist) * uCursorStrength;
          float wave = sin(dist * 0.2 - uTime * 5.1) * 0.82;
          wave += cos(dist * 0.115 + uTime * 2.7) * 0.34;
          p.y += wave * falloff;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * uPixelRatio * (540.0 / max(120.0, -mvPosition.z));
          vAlpha = aAlpha * uModeMix * uDistanceFade;
          vColor = aColor;
          vRevealWorldXZ = p.xz;
        }
      `,fragmentShader:`
        uniform float uRevealActive;
        uniform vec2 uRevealCenter;
        uniform float uRevealRadius;
        uniform float uRevealFeather;
        uniform float uRevealDataInside;
        varying float vAlpha;
        varying vec3 vColor;
        varying vec2 vRevealWorldXZ;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float alpha = smoothstep(0.5, 0.12, d) * vAlpha;
          if (uRevealActive > 0.5) {
            float revealDist = distance(vRevealWorldXZ, uRevealCenter);
            float revealEdge = smoothstep(uRevealRadius - uRevealFeather, uRevealRadius + uRevealFeather, revealDist);
            alpha *= mix(revealEdge, 1.0 - revealEdge, uRevealDataInside);
          }
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `}));z.frustumCulled=!1,z.renderOrder=0,z.visible=!1,e.add(z);const I=new be(1,72);I.rotateX(-Math.PI/2);const O=new Pe(.88,1,96);O.rotateX(-Math.PI/2);const c=new le(I,new $({color:3208959,transparent:!0,opacity:.045,depthWrite:!1,blending:k,toneMapped:!1,side:Y}),A.length),R=new le(O,new $({color:6619125,transparent:!0,opacity:0,depthWrite:!1,blending:k,toneMapped:!1,side:Y}),A.length);Q(R.material,d),c.frustumCulled=!1,R.frustumCulled=!1,c.renderOrder=2,R.renderOrder=3,c.visible=!1,R.visible=!1,e.add(c,R);const F=new Te,_=new N;A.forEach((w,T)=>{const B=w.radius||w.r||24;F.makeScale(B,B,B),F.setPosition(w.x,t+.04,w.z),c.setMatrixAt(T,F),F.makeScale(B*1.02,B*1.02,B*1.02),F.setPosition(w.x,t+.08,w.z),R.setMatrixAt(T,F),_.set(w.accent||(w.future?"#45ff9d":"#36ecff")),c.setColorAt(T,_),R.setColorAt(T,_.offsetHSL(0,.08,.12))}),c.instanceMatrix.needsUpdate=!0,R.instanceMatrix.needsUpdate=!0,c.instanceColor.needsUpdate=!0,R.instanceColor.needsUpdate=!0;const P=We(e,a,{floorY:t,districts:A});Q(P.lineMaterial,d);let E=!1;const G=ee.islandTop+1.15;return{setEnabled(w){const T=!!w;h=T?1:0,T&&(M.visible=!0),T&&(z.visible=!0),c.visible=!1,T&&(R.visible=!0),T&&P.setVisible(!0)},setWireOverlay(w){return E=!!w,P.setOverlay(E,G-(t+.9)),E?P.setVisible(!0):u===0&&P.setVisible(!1),E},getWireOverlay(){return E},update(w,T=0){u+=(h-u)*(g?Ue:.12),h===0&&u<.01?(u=0,M.visible=!1,z.visible=!1,R.visible=!1,E||P.setVisible(!1)):u>0&&(M.visible=!0,z.visible=!0,R.visible=!0,P.setVisible(!0)),v.lerp(m,.18),p+=(x-p)*.16,z.material.uniforms.uTime.value=w,z.material.uniforms.uPixelRatio.value=Math.min(window.devicePixelRatio||1,2),z.material.uniforms.uCursorCenter.value.copy(v),z.material.uniforms.uCursorStrength.value=p,z.material.uniforms.uModeMix.value=u,z.material.uniforms.uDistanceFade.value=1-Z(Ye,qe,T),z.material.uniforms.uRevealActive.value=d.active?1:0,z.material.uniforms.uRevealCenter.value.copy(d.center),z.material.uniforms.uRevealRadius.value=d.radius,z.material.uniforms.uRevealFeather.value=d.feather,M.material.opacity=o*u,R.material.opacity=s*u,P.update(w,u,1-Z(1e3,1600,T)),P.setRevealMask(d),L(M.material,d),L(R.material,d),L(P.lineMaterial,d)},setRipple(w,T,B){m.set(w,T),v.x>9e4&&v.copy(m),x=1},clearRipple(){x=0},setRevealMask(w=null){d.active=!!w?.active,g=d.active,w?.center&&d.center.set(w.center.x,w.center.z),Number.isFinite(w?.radius)&&(d.radius=w.radius),d.feather=Number.isFinite(w?.feather)?w.feather:18,d.dataInside=w?.dataInside!==!1,z.material.uniforms.uRevealActive.value=d.active?1:0,z.material.uniforms.uRevealCenter.value.copy(d.center),z.material.uniforms.uRevealRadius.value=d.radius,z.material.uniforms.uRevealFeather.value=d.feather,z.material.uniforms.uRevealDataInside.value=d.dataInside?1:0,P.setRevealMask(d),L(M.material,d),L(R.material,d),L(P.lineMaterial,d)},dispose(){P.dispose(),e.remove(M,z,c,R),y.dispose(),S.dispose(),b.dispose(),z.material.dispose(),c.geometry.dispose(),c.material.dispose(),R.geometry.dispose(),R.material.dispose()}}}function Q(e,a){e.userData.insideRevealShader=null,e.onBeforeCompile=i=>{i.uniforms.uRevealActive={value:a.active?1:0},i.uniforms.uRevealCenter={value:a.center.clone()},i.uniforms.uRevealRadius={value:a.radius},i.uniforms.uRevealFeather={value:a.feather},i.uniforms.uRevealDataInside={value:a.dataInside?1:0},i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vRevealWorldPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vec4 revealWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  revealWorldPosition = instanceMatrix * revealWorldPosition;
#endif
revealWorldPosition = modelMatrix * revealWorldPosition;
vRevealWorldPosition = revealWorldPosition.xyz;`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
uniform float uRevealActive;
uniform vec2 uRevealCenter;
uniform float uRevealRadius;
uniform float uRevealFeather;
uniform float uRevealDataInside;
varying vec3 vRevealWorldPosition;`).replace("#include <alphatest_fragment>",`#include <alphatest_fragment>
if (uRevealActive > 0.5) {
  float revealDist = distance(vRevealWorldPosition.xz, uRevealCenter);
  float revealEdge = smoothstep(uRevealRadius - uRevealFeather, uRevealRadius + uRevealFeather, revealDist);
  float revealMaskAlpha = mix(revealEdge, 1.0 - revealEdge, uRevealDataInside);
  if (revealMaskAlpha < 0.01) discard;
  diffuseColor.a *= revealMaskAlpha;
}`),e.userData.insideRevealShader=i,L(e,a)},e.customProgramCacheKey=()=>"insideRevealMask"}function L(e,a){const i=e.userData.insideRevealShader;if(!i){e.needsUpdate=!0;return}i.uniforms.uRevealActive.value=a.active?1:0,i.uniforms.uRevealCenter.value.copy(a.center),i.uniforms.uRevealRadius.value=a.radius,i.uniforms.uRevealFeather.value=a.feather,i.uniforms.uRevealDataInside.value=a.dataInside?1:0}function He(e,a,i,n={}){const t=Number.isFinite(n.dotSizeScale)?n.dotSizeScale:1,r=Number.isFinite(n.dotAlphaScale)?n.dotAlphaScale:1,l=Number.isFinite(n.spacing)?Math.max(3.6,n.spacing):3.6,f=Math.max(700,e*1.45),o=f*1.03,s=[],m=[],v=[],p=[],x=new N(8641023),u=new N,h=new N,g=i.map(y=>({x:y.x,z:y.z,radius:y.radius||y.r||24,color:new N(y.accent||(y.future?"#45ff9d":"#36ecff"))})),d=l*Math.sqrt(3)*.5;let A=0;for(let y=-o;y<=o;y+=d){const S=A%2*l*.5;for(let M=-o;M<=o;M+=l){const b=M+S,z=Math.hypot(b,y);if(z>o)continue;let I=null,O=1/0;for(const B of g){const re=Math.hypot(b-B.x,y-B.z);re<O&&(I=B,O=re)}const c=I?1-Z(I.radius*.62,I.radius*1.08,O):0,R=I?1-Math.abs(.5-Z(I.radius*.78,I.radius*1.18,O))*2:0,F=Math.sin(b*.018+y*.012)*.32+Math.cos(y*.026-b*.008)*.22,_=c*(1.45+Math.sin(b*.08)*.16+Math.cos(y*.075)*.16),P=R*.58,E=.22+F*(1-c*.65)+_+P,G=1-Z(f*.78,f*1.03,z),w=.08+G*.22+c*.2+R*.1,T=1.45+G*.62+c*.52;u.copy(I?.color||x).offsetHSL(0,.05,.08),h.copy(x).lerp(u,Math.min(1,c*.78+R*.35)),s.push(b,a+E,y),m.push(w*r),v.push(T*t*Ke),p.push(h.r,h.g,h.b)}A+=1}const C=new j;return C.setAttribute("position",new W(s,3)),C.setAttribute("aAlpha",new W(m,1)),C.setAttribute("aSize",new W(v,1)),C.setAttribute("aColor",new W(p,3)),C}function Z(e,a,i){const n=Math.min(1,Math.max(0,(i-e)/(a-e)));return n*n*(3-2*n)}const U=96;function at(e,{onPass:a,onComplete:i}={}){const n=new xe(je(),new ne({uniforms:{uOpacity:{value:0},uColor:{value:new N(D.color)}},vertexShader:`
        attribute float ringAlpha;
        varying float vRingAlpha;
        void main() {
          vRingAlpha = ringAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,fragmentShader:`
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vRingAlpha;
        void main() {
          float alpha = vRingAlpha * uOpacity;
          if (alpha < 0.01) discard;
          vec3 color = uColor * (0.68 + vRingAlpha * 0.92);
          gl_FragColor = vec4(color, alpha);
        }
      `,transparent:!0,blending:k,depthWrite:!1,depthTest:!0,side:Y}));n.name="RevealRim",n.position.y=ee.water+.24,n.renderOrder=5,n.visible=!1,n.frustumCulled=!1,e.add(n);const t={active:!1,radius:D.startRadius,targetRadius:0,loadedRadius:D.startRadius,center:new X(0,0),warm:!1,completed:!1,mode:"load",transition:null,passed:new Set,waypoints:[]};function r(v,p,x,{warm:u=!1,maxRadius:h=700}={}){t.active=!0,t.completed=!1,t.mode="load",t.transition=null,t.warm=u,t.center.set(v,p),t.radius=D.startRadius,t.targetRadius=h,t.loadedRadius=D.startRadius,t.passed.clear(),t.waypoints=x.map(g=>({id:g.id,distance:Math.hypot(g.x-v,g.z-p)})).sort((g,d)=>g.distance-d.distance),n.position.x=v,n.position.z=p,n.visible=!0,n.material.uniforms.uOpacity.value=1}function l(v){t.loadedRadius=Math.max(t.loadedRadius,v+26)}function f(v){if(!t.active)return;if(t.mode==="transition"&&t.transition){m(v);return}const p=D.speed*(t.warm?D.warmSpeedMultiplier:1),x=Math.min(t.targetRadius,Math.max(t.radius+p*v,0)),u=Math.max(t.loadedRadius,D.startRadius);t.radius=Math.min(x,Math.max(t.radius,u)),o();const h=t.targetRadius*.86,g=t.radius>h?1-te((t.radius-h)/(t.targetRadius-h),0,1):1;n.material.uniforms.uOpacity.value=g,q(n.geometry,t.radius),t.radius>=t.targetRadius-.5&&(t.active=!1,t.completed=!0,n.visible=!1,i&&i())}function o(){for(const v of t.waypoints)!t.passed.has(v.id)&&v.distance<=t.radius&&(t.passed.add(v.id),a&&a(v.id))}function s(v,p,{maxRadius:x=760,durationMs:u=1100,switchAt:h=.34,color:g=D.color,dataReveal:d=!1,onUpdate:A=null,onSwitch:C=null,onComplete:y=null}={}){t.active=!0,t.completed=!1,t.mode="transition",t.center.set(v,p),t.radius=D.startRadius,t.targetRadius=x,t.transition={elapsedMs:0,durationMs:u,switchAt:h,dataReveal:d,onUpdate:A,switched:!1,onSwitch:C,onComplete:y},n.position.x=v,n.position.z=p,n.visible=!0,n.material.uniforms.uColor.value.set(g),n.material.uniforms.uOpacity.value=1,q(n.geometry,t.radius)}function m(v){const p=t.transition;p.elapsedMs+=Math.min(v,.05)*1e3;const x=te(p.elapsedMs/p.durationMs,0,1),u=De(x);t.radius=D.startRadius+(t.targetRadius-D.startRadius)*u,q(n.geometry,t.radius),o(),p.onUpdate?.(t);const h=me(0,.12,x),g=1-me(.82,1,x);n.material.uniforms.uOpacity.value=Math.max(0,h*g),!p.switched&&x>=p.switchAt&&(p.switched=!0,p.onSwitch?.()),x>=1&&(t.active=!1,t.completed=!0,t.transition=null,n.visible=!1,n.material.uniforms.uColor.value.set(D.color),p.onComplete?.())}return{ring:n,state:t,begin:r,beginTransition:s,update:f,reportLoadedRadius:l}}function je(){const e=[0,.28,1,.28,0],a=e.length,i=(U+1)*a,n=new Float32Array(i*3),t=new Float32Array(i),r=[];for(let f=0;f<=U;f+=1)for(let o=0;o<a;o+=1)t[f*a+o]=e[o];for(let f=0;f<U;f+=1)for(let o=0;o<a-1;o+=1){const s=f*a+o,m=(f+1)*a+o;r.push(s,m,s+1,s+1,m,m+1)}const l=new j;return l.setAttribute("position",new ue(n,3)),l.setAttribute("ringAlpha",new ue(t,1)),l.setIndex(r),l.userData.lastRadius=-1,q(l,1),l}function q(e,a){if(Math.abs(e.userData.lastRadius-a)<.05)return;e.userData.lastRadius=a;const i=e.getAttribute("position"),n=5,t=[Math.max(0,a-D.ringGlowWidth),Math.max(0,a-D.ringHalfWidth),a,a+D.ringHalfWidth,a+D.ringGlowWidth];for(let r=0;r<=U;r+=1){const l=r/U*Math.PI*2,f=Math.cos(l),o=Math.sin(l);for(let s=0;s<n;s+=1){const m=r*n+s;i.setXYZ(m,f*t[s],0,o*t[s])}}i.needsUpdate=!0}function me(e,a,i){const n=te((i-e)/(a-e),0,1);return n*n*(3-2*n)}export{at as a,ge as b,tt as c,et as d,Ie as g,Qe as r};
