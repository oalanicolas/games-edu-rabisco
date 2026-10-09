import{CITY_BOUNDS as oe}from"./city-index.ClvezBZL.js";import{e as D,a as re,V as E,x as se,f as U,g as V,q as le,h as $,U as ne,aH as Y,ar as I,aF as J,Z as ie,_ as ue,ai as K,az as ce,z as he,af as fe,E as me,a2 as ve,K as de,L as Z}from"./config.DkDxwQJL.js";import{c as W,a as pe}from"./utils.C9s8-uzD.js";function ke(y,k,s=oe){const M=we(k,s),h=Q(),i={uTime:{value:0},uShoreMask:{value:M},uNormalMap:{value:h},uBoundsScale:{value:1/(s*2)},uDeepColor:{value:new D(1349318)},uShallowColor:{value:new D(4580082)},uFoamColor:{value:new D(15268863)},uHorizonColor:{value:new D(13235196)},uZenithColor:{value:new D(7327224)},uSunColor:{value:new D(16774351)},uSunDir:{value:new E(-.5,.6,-.5)},uSunStrength:{value:1},uSparkle:{value:2.85},uGloss:{value:1.2},uClarity:{value:1.25},uCaustics:{value:1},uSeabed:{value:1},uFoam:{value:.55},uWaves:{value:1.2},uShelfSpread:{value:.7},uBiolum:{value:1},uNight:{value:0},uDebugMask:{value:typeof location<"u"&&new URLSearchParams(location.search).has("debugmask")?1:0},uRevealActive:{value:0},uRevealCenter:{value:new re(0,0)},uRevealRadius:{value:0},uRevealFeather:{value:18},uRevealDataInside:{value:1},fogColor:{value:new D(14283764)},fogNear:{value:660},fogFar:{value:2050}},R=new se({uniforms:i,precision:"highp",transparent:!0,depthWrite:!1,vertexShader:`
      uniform float uBoundsScale;
      varying vec2 vWorldXZ;
      varying vec2 vMaskUv;
      varying vec3 vWorldPosition;
      varying float vFogDepth;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPosition.xz;
        // Precompute the shore-mask UV here (a small 0..1 value) instead of
        // deriving it in the fragment shader from the huge world coordinates.
        // On mobile the fragment-side maths + varying interpolation of ±2000
        // coords is imprecise and the mask reads as hard triangular wedges;
        // interpolating a 0..1 varying is precise everywhere.
        vMaskUv = worldPosition.xz * uBoundsScale + 0.5;
        vWorldPosition = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform sampler2D uShoreMask;
      uniform sampler2D uNormalMap;
      uniform float uBoundsScale;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uZenithColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunStrength;
      uniform float uSparkle;
      uniform float uGloss;
      uniform float uClarity;
      uniform float uCaustics;
      uniform float uSeabed;
      uniform float uFoam;
      uniform float uWaves;
      uniform float uShelfSpread;
      uniform float uBiolum;
      uniform float uNight;
      uniform float uDebugMask;
      uniform float uRevealActive;
      uniform vec2 uRevealCenter;
      uniform float uRevealRadius;
      uniform float uRevealFeather;
      uniform float uRevealDataInside;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vWorldXZ;
      varying vec2 vMaskUv;
      varying vec3 vWorldPosition;
      varying float vFogDepth;

      void main() {
        if (uRevealActive > 0.5) {
          float revealDist = distance(vWorldXZ, uRevealCenter);
          float revealEdge = smoothstep(uRevealRadius - uRevealFeather, uRevealRadius + uRevealFeather, revealDist);
          float revealMaskAlpha = mix(1.0 - revealEdge, revealEdge, uRevealDataInside);
          if (revealMaskAlpha < 0.01) discard;
        }
        float mask = texture2D(uShoreMask, vMaskUv).r;
        if (uDebugMask > 0.5) { gl_FragColor = vec4(vec3(mask), 1.0); return; }

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float viewDist = length(cameraPosition - vWorldPosition);

        // --- surface normal from two scrolling tileable normal maps ------
        // Domain-warp the sample coords with a slow, low-frequency distortion
        // so the tileable normal map does not read as an obvious repeating grid
        // at grazing angles.
        // A large, slow warp breaks the visible large-scale repeat; three
        // octaves (incl. a fine fast one) keep the surface from reading as a
        // single smooth tiling.
        vec2 warp = (texture2D(uNormalMap, vWorldXZ * 0.004 + vec2(uTime * 0.004, -uTime * 0.003)).xy - 0.5) * 22.0;
        vec2 wp = vWorldXZ + warp;
        // A second, ~36deg-rotated lattice: samples taken on it can never line
        // up with the unrotated ones, which kills the visible tiling repeat
        // (most obvious as a honeycomb pattern down the sun path).
        vec2 wr = vec2(wp.x * 0.809 - wp.y * 0.588, wp.x * 0.588 + wp.y * 0.809);
        vec3 t1 = texture2D(uNormalMap, wp * 0.012 + vec2(uTime * 0.009, uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 t2 = texture2D(uNormalMap, wr * 0.043 + vec2(-uTime * 0.017, uTime * 0.011)).xyz * 2.0 - 1.0;
        vec3 t3 = texture2D(uNormalMap, wp * 0.088 + vec2(uTime * 0.006, -uTime * 0.022)).xyz * 2.0 - 1.0;
        // Fade ripple strength with distance so far water stays calm and
        // the specular never aliases into noise.
        float ripple = 1.05 / (1.0 + viewDist * 0.0016);
        vec2 nXZ = (t1.xy * 0.6 + t2.xy * 0.45 + t3.xy * 0.32) * ripple;
        vec3 normal = normalize(vec3(nXZ.x, 1.0, nXZ.y));

        // --- shelf depth proxy --------------------------------------------
        // uShelfSpread bends the shore distance-field: >1 makes the shallows
        // drop off more gently (wider turquoise shelf, gentler bottom slope),
        // <1 makes it steeper. Depth-driven effects read from this bent mask.
        float shelfMask = pow(clamp(mask, 0.0, 1.0), 1.0 / clamp(uShelfSpread, 0.3, 3.0));
        float shelfBand = smoothstep(0.12, 0.92, shelfMask);

        // --- seabed bathymetry + reef detail ------------------------------
        // One tap each (both channels) for bathymetry + reef to keep the water
        // fragment cost down (it covers a huge plane).
        vec2 sand = texture2D(uNormalMap, vWorldXZ * 0.008).xy;
        float bedTone = (clamp(0.5 + (sand.x - 0.5) * 1.5 + (sand.y - 0.5) * 1.1, 0.0, 1.0) - 0.5) * shelfBand * uSeabed;
        // Reef/rock: higher-frequency so it reads as many small patches of
        // dark coral/rock scattered over the sand, not one broad tonal wash.
        vec2 rf = texture2D(uNormalMap, vWorldXZ * 0.16).xy;
        float reef = smoothstep(0.62, 0.92, rf.x * 0.6 + rf.y * 0.55) * shelfBand * uSeabed;

        // --- water body color: turquoise absorption by depth proxy -------
        // Turquoise reaches deeper (ramp starts sooner); the very shallows
        // fade toward a pale sandy white-cyan the way clear reef water does.
        float shallow = smoothstep(0.0, 0.85, shelfMask);
        float absorb = 1.0 - exp(-shallow * 2.3);
        vec3 water = mix(uDeepColor, uShallowColor, absorb);
        water = mix(water, vec3(0.82, 0.97, 0.95), smoothstep(0.72, 1.0, mask));
        // Sandy bathymetry patches brighten/darken the bottom; reef darkens to
        // a teal-green rock so the shallows have visible bottom detail.
        water *= 1.0 + bedTone * 0.7;
        water = mix(water, water * vec3(0.42, 0.66, 0.6), reef * 0.7);
        // Living surface shading from the scrolling normal layers.
        water *= 0.94 + (t1.x * 0.55 + t2.x * 0.45) * 0.14;

        // --- caustics: a fine ridged light-web, not big soft blobs --------
        // Higher frequency + ridged (1 - abs of summed sines) + sharpened, so
        // it reads as thin bright curves of focused light. Tinted (not pure
        // white) and gently scaled so even high slider values shimmer instead
        // of blowing out into white clouds.
        // Domain-warped so the ridge web wanders instead of forming a regular
        // grid; three differently-angled gratings break up any residual repeat.
        vec2 caUv = vWorldXZ * 0.4 + nXZ * 1.1 + warp * 0.9;
        float c1 = sin(caUv.x + caUv.y * 0.35 + uTime * 0.5);
        float c2 = sin(caUv.y * 1.1 - caUv.x * 0.3 - uTime * 0.42);
        float c3 = sin((caUv.x - caUv.y) * 0.72 + uTime * 0.33);
        float caw = abs(c1 + c2) + abs(c3) * 0.7;
        float caustic = pow(clamp(1.0 - caw * 0.5, 0.0, 1.0), 2.2) * shelfBand * uCaustics;
        vec3 causticTint = mix(vec3(0.9, 1.0, 0.97), uShallowColor, 0.4);
        water += causticTint * caustic * 0.16;

        // --- broad rolling swell: brightness undulation = open-water waves --
        float swell = sin(vWorldXZ.x * 0.02 - vWorldXZ.y * 0.013 + uTime * 0.7)
                    * sin(vWorldXZ.x * 0.008 + vWorldXZ.y * 0.022 - uTime * 0.5);
        water *= 1.0 + swell * 0.09 * uWaves;

        // --- cloud shadows: soft patches drifting across the water ---------
        float cloudShade = texture2D(uNormalMap, vWorldXZ * 0.0016 + vec2(uTime * 0.0034, uTime * 0.0021)).y;
        water *= 0.88 + 0.2 * cloudShade;

        // --- fresnel sky reflection --------------------------------------
        vec3 reflected = reflect(-viewDir, normal);
        vec3 sky = mix(uHorizonColor, uZenithColor, clamp(reflected.y * 1.6, 0.0, 1.0));
        float fresnel = 0.05 + 0.6 * pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.0);
        vec3 color = mix(water, sky, fresnel);

        // --- sun reflection: a broken glitter field, not a solid hotspot ---
        // The old smooth broad glint made one bright CHUNK that blew out while
        // the rest read matte. Instead we drive the specular with fine, fast
        // animated detail normals so the sun path shatters into many glints of
        // mixed size. A tiny smooth sheen floor keeps non-glint water from
        // going dead-matte. Everything fades on zoom-out to a clean sheen.
        vec3 halfDir = normalize(uSunDir + viewDir);
        vec3 d1 = texture2D(uNormalMap, wp * 0.15 + vec2(uTime * 0.05, -uTime * 0.043)).xyz * 2.0 - 1.0;
        vec3 d2 = texture2D(uNormalMap, wr * 0.31 + vec2(-uTime * 0.037, uTime * 0.055)).xyz * 2.0 - 1.0;
        float sparkleFade = 1.0 / (1.0 + viewDist * 0.005);
        vec2 sXZ = nXZ * 0.35 + (d1.xy * 0.9 + d2.xy * 0.65) * sparkleFade;
        vec3 sparkleNormal = normalize(vec3(sXZ.x, 1.0, sXZ.y));
        float sndh = clamp(dot(sparkleNormal, halfDir), 0.0, 1.0);
        // Two sparkle scales over the SAME broken normal: medium glints spread
        // across the sun path (break up the chunk) + tiny bright sparks (bloom).
        float sparkMed = smoothstep(0.35, 1.0, pow(sndh, 70.0)) * 0.55;
        float sparkFine = smoothstep(0.5, 1.0, pow(sndh, 340.0)) * 1.15;
        float sparkle = (sparkMed + sparkFine) * sparkleFade * uSparkle;
        // Gentle glossy floor from the smooth surface normal (kept low so it
        // never fills into a solid sheet).
        float ndh = clamp(dot(normal, halfDir), 0.0, 1.0);
        float sheen = pow(ndh, 40.0) * 0.16 * uGloss;
        color += uSunColor * (sparkle + sheen) * uSunStrength;

        // --- foam & rolling waves at the shore ----------------------------
        // A broad bright surf band at the visible waterline (uFoam), plus
        // rolling swell lines that march shoreward and BREAK into whitecaps as
        // they approach the beach (uWaves). Faded with distance so they never
        // alias into a grid when zoomed out, and bent by the along-shore field
        // + ripple so they wander instead of being dead-straight contours.
        float wobble = (t1.y + t2.x) * 0.05;
        float shoreFoam = smoothstep(0.36, 0.6, mask + wobble)
          * (1.0 - smoothstep(0.82, 0.95, mask + wobble));
        float waveFade = 1.0 / (1.0 + viewDist * 0.006);
        float alongShore = texture2D(uNormalMap, vWorldXZ * 0.045 + vec2(uTime * 0.02, -uTime * 0.015)).x;
        // Breaking waves washing shoreward. Waves purely of the shore distance
        // (mask) read as clean parallel contours -> a "reversed ripple", so we
        // DISTORT the wave phase hard with the animated normals + along-shore
        // noise (crest lines wobble and wander) and GATE it with a patchy mask
        // (crests appear as broken foam, not continuous lines). Time is wrapped
        // with mod so the fract() argument stays bounded -> no precision
        // breakdown on mobile Safari (which runs the fragment shader mediump).
        float wt = mod(uTime * 0.3, 60.0); // slow + bounded
        // Surf like the aerial-reference photos:
        // - TWO incommensurate wave trains stagger the fronts, so spacing
        //   varies and sets merge/lag instead of marching in lockstep
        // - each front takes its own amplitude from a golden-ratio hash of
        //   its band index (stable while the front travels), so some waves
        //   roll in big and others barely register
        // - bending is gentle and mostly low-frequency: leading edges arrive
        //   as clean arcs; the TAIL alone gets extra wobble + speckle so the
        //   dissipating wash stays ragged while the front stays crisp.
        // Every fract()/floor() argument stays bounded (mobile-safe).
        float bend = (alongShore - 0.5) * 2.0 + t1.x * 0.35 + t3.y * 0.3;
        float tailWobble = (t2.x + t3.x) * 0.09 + alongShore * 0.08;
        float base1 = mask * 5.0 - wt + bend;
        float phase1 = fract(base1);
        float amp1 = 0.35 + 0.75 * fract(floor(base1) * 0.618034);
        float wCrest1 = smoothstep(0.52, 0.85, phase1 - tailWobble)
          * (1.0 - smoothstep(0.9, 0.97, phase1)) * amp1;
        float base2 = mask * 2.3 - wt * 0.62 + bend * 0.7;
        float phase2 = fract(base2);
        float amp2 = 0.3 + 0.7 * fract(floor(base2) * 0.618034 + 0.37);
        float wCrest2 = smoothstep(0.5, 0.86, phase2 - tailWobble)
          * (1.0 - smoothstep(0.9, 0.97, phase2)) * amp2;
        // Foamy texture inside the wash: intensity speckle, not bending.
        float crest = max(wCrest1, wCrest2 * 0.8) * (0.72 + 0.5 * t2.x);
        float breakPatch = smoothstep(0.2, 0.6, alongShore * 0.5 + t2.x * 0.5 + 0.3);
        float breakZone = smoothstep(0.2, 0.62, mask) * (1.0 - smoothstep(0.82, 0.97, mask));
        float waveShape = crest * max(breakPatch, 0.45) * breakZone * waveFade; // for biolum
        float crests = waveShape * uWaves;
        float foam = clamp(shoreFoam * 0.9 * uFoam + crests, 0.0, 1.0);
        // --- bioluminescence at night -------------------------------------
        // Some shore stretches (a drifting threshold, not the whole coast) glow
        // cyan; the glow RIDES THE MOVING CRESTS so it surges with the waves
        // like real plankton, plus a faint rim in the shallows. The plain white
        // surf is toned down at night so the glow dominates.
        float glowStretch = uNight > 0.01 ? smoothstep(0.42, 0.62, alongShore) * uNight : 0.0;
        vec3 nightWhite = uFoamColor * (1.0 - uNight * 0.6);
        vec3 foamCol = mix(nightWhite, vec3(0.16, 1.0, 0.82), glowStretch);
        color = mix(color, foamCol, foam);
        float biolumA = 0.0;
        if (glowStretch > 0.01) {
          float pulse = 0.7 + 0.3 * sin(uTime * 0.8 + vWorldXZ.x * 0.02 + vWorldXZ.y * 0.016);
          float rim = smoothstep(0.32, 0.66, mask) * (1.0 - smoothstep(0.86, 1.0, mask));
          // Moving wave crests carry most of the glow (independent of the
          // Waves slider so it always animates); the rim is a faint base.
          float glow = (waveShape * 2.2 + rim * 0.5) * glowStretch * pulse * uBiolum;
          color += vec3(0.1, 0.9, 0.72) * glow * 1.8;
          biolumA = clamp(glow * 1.6, 0.0, 1.0);
        }

        // --- transparency ---------------------------------------------------
        // A WIDE clear shelf: the whole sandy shallows read transparent so the
        // seabed shows, fading to near-opaque only in true deep ocean.
        // Deep ocean is near-opaque (0.95): the submerged island skirts overlap
        // and crease in the channels between islands, and that seam shows as an
        // ugly underwater ridge if the deep water is too clear. Hide it here;
        // the shallows stay transparent for the reef look.
        float minAlpha = clamp(0.14 - (uClarity - 1.0) * 0.09, 0.03, 0.45);
        float alpha = mix(0.95, minAlpha, smoothstep(0.12, 0.55, shelfMask));
        // Seabed detail is nearly invisible when the water is very clear (the
        // water colour barely contributes), so let it nudge opacity too: bright
        // caustic ribbons and dark reef read through the transparent shallows.
        alpha += min(caustic, 1.0) * 0.18 + min(reef, 1.0) * 0.3 + bedTone * 0.12;
        alpha = max(alpha, foam * 0.72);
        alpha = max(alpha, biolumA);
        alpha = clamp(alpha + fresnel * 0.16 + sparkle * 0.08, 0.0, 1.0);

        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        color = mix(color, fogColor, fogFactor);
        alpha = mix(alpha, 1.0, fogFactor);

        gl_FragColor = vec4(color, alpha);
      }
    `}),u=Math.max(3600,s*2+2600),C=Math.min(160,Math.max(48,Math.round(u/40))),v=new U(new V(u,u,C,C),R);v.rotation.x=-Math.PI/2,v.position.y=le.water,v.name="Water",v.renderOrder=1,v.frustumCulled=!1,y.add(v);const l=new $({color:1138557});ge(l,i);const f=new U(new V(u,u),l);f.rotation.x=-Math.PI/2,f.position.y=-11.2,f.name="Seabed",f.frustumCulled=!1,y.add(f);const a=new E,r=new D,m={waterGlitter:"uSparkle",waterGloss:"uGloss",waterClarity:"uClarity",waterCaustics:"uCaustics",waterSeabed:"uSeabed",waterFoam:"uFoam",waterWaves:"uWaves",waterShelfSpread:"uShelfSpread",waterBiolum:"uBiolum"};return{mesh:v,setDataView(o){const t=!o;v.visible=t,f.visible=t},setTuning(o={}){for(const[t,w]of Object.entries(m))if(t in o){const e=Number(o[t]);Number.isFinite(e)&&(i[w].value=Math.max(0,e))}},getTuning(){const o={};for(const[t,w]of Object.entries(m))o[t]=i[w].value;return o},setRevealMask(o=null){const t=!!o?.active;i.uRevealActive.value=t?1:0,o?.center&&i.uRevealCenter.value.set(o.center.x,o.center.z),i.uRevealRadius.value=Number.isFinite(o?.radius)?o.radius:0,i.uRevealFeather.value=Number.isFinite(o?.feather)?o.feather:18,i.uRevealDataInside.value=o?.dataInside!==!1?1:0;const w=l.userData.outsideRevealShader;w?(w.uniforms.uRevealActive.value=i.uRevealActive.value,w.uniforms.uRevealCenter.value.copy(i.uRevealCenter.value),w.uniforms.uRevealRadius.value=i.uRevealRadius.value,w.uniforms.uRevealFeather.value=i.uRevealFeather.value,w.uniforms.uRevealDataInside.value=i.uRevealDataInside.value):l.needsUpdate=!0},update(o,t,w=1,e=null,p=!1){if(i.uTime.value=o,t){i.uDeepColor.value.setHex(t.waterDeep),i.uShallowColor.value.setHex(t.waterShallow),i.uHorizonColor.value.setHex(t.skyHorizon),i.uZenithColor.value.setHex(t.skyHigh),i.uSunColor.value.setHex(t.sunColor);const c=t.sunAzimuth,g=t.sunElevation;let d=c;if(p&&e!==null){let z=e+Math.PI-d;z=Math.atan2(Math.sin(z),Math.cos(z)),d+=z*.72}const n=p?Math.min(Math.max(g,.16),.46):g,b=p?Math.sin(n):Math.max(.08,Math.sin(n));a.set(Math.cos(d)*Math.cos(n),b,Math.sin(d)*Math.cos(n)).normalize(),i.uSunDir.value.copy(a),i.uSunStrength.value=.35+t.waterSparkle;const S=t.stars||0,x=Math.max(0,Math.min(1,(S-.5)/.42));i.uNight.value=x*x*(3-2*x),i.fogColor.value.setHex(t.fogColor),i.fogNear.value=t.fogNear*w,i.fogFar.value=t.fogFar*w,r.setHex(t.waterDeep).multiplyScalar(.62),l.color.copy(r)}},dispose(){v.geometry.dispose(),f.geometry.dispose(),l.dispose(),R.dispose(),M.dispose(),h.dispose()}}}function ge(y,k){y.userData.outsideRevealShader=null,y.onBeforeCompile=s=>{s.uniforms.uRevealActive={value:k.uRevealActive.value},s.uniforms.uRevealCenter={value:k.uRevealCenter.value.clone()},s.uniforms.uRevealRadius={value:k.uRevealRadius.value},s.uniforms.uRevealFeather={value:k.uRevealFeather.value},s.uniforms.uRevealDataInside={value:k.uRevealDataInside.value},s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vRevealWorldPosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vec4 revealWorldPosition = vec4(transformed, 1.0);
revealWorldPosition = modelMatrix * revealWorldPosition;
vRevealWorldPosition = revealWorldPosition.xyz;`),s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
uniform float uRevealActive;
uniform vec2 uRevealCenter;
uniform float uRevealRadius;
uniform float uRevealFeather;
uniform float uRevealDataInside;
varying vec3 vRevealWorldPosition;`).replace("#include <alphatest_fragment>",`#include <alphatest_fragment>
if (uRevealActive > 0.5) {
  float revealDist = distance(vRevealWorldPosition.xz, uRevealCenter);
  float revealEdge = smoothstep(uRevealRadius - uRevealFeather, uRevealRadius + uRevealFeather, revealDist);
  float revealMaskAlpha = mix(1.0 - revealEdge, revealEdge, uRevealDataInside);
  if (revealMaskAlpha < 0.01) discard;
}`),y.userData.outsideRevealShader=s},y.customProgramCacheKey=()=>"outsideWaterRevealMask"}let X=null;function Se(){return X||(X=Q()),X}function Q(){const k=pe(40404),s=[{cells:4,amp:1},{cells:8,amp:.55},{cells:16,amp:.3},{cells:32,amp:.16}].map(({cells:u,amp:C})=>{const v=new Float32Array(u*u);for(let l=0;l<v.length;l+=1)v[l]=k();return{cells:u,amp:C,lattice:v}}),M=new Float32Array(512*512);for(const{cells:u,amp:C,lattice:v}of s){const l=u/512;for(let f=0;f<512;f+=1){const a=f*l,r=Math.floor(a)%u,m=(r+1)%u,o=j(a-Math.floor(a));for(let t=0;t<512;t+=1){const w=t*l,e=Math.floor(w)%u,p=(e+1)%u,c=j(w-Math.floor(w)),g=v[r*u+e],d=v[r*u+p],n=v[m*u+e],b=v[m*u+p];M[f*512+t]+=C*B(B(g,d,c),B(n,b,c),o)}}}const h=new Uint8Array(512*512*4),i=2.2;for(let u=0;u<512;u+=1){const C=(u-1+512)%512,v=(u+1)%512;for(let l=0;l<512;l+=1){const f=(l-1+512)%512,a=(l+1)%512,r=(M[u*512+a]-M[u*512+f])*i,m=(M[v*512+l]-M[C*512+l])*i,o=1/Math.sqrt(r*r+m*m+1),t=(u*512+l)*4;h[t]=Math.round((-r*o*.5+.5)*255),h[t+1]=Math.round((-m*o*.5+.5)*255),h[t+2]=Math.round((o*.5+.5)*255),h[t+3]=255}}const R=new ie(h,512,512,ue);return R.wrapS=K,R.wrapT=K,R.magFilter=I,R.minFilter=ce,R.generateMipmaps=!0,R.colorSpace=J,R.needsUpdate=!0,R}function j(y){return y*y*(3-2*y)}function B(y,k,s){return y+(k-y)*s}function we(y,k){const s=k>700?2048:1024,M=document.createElement("canvas");M.width=s,M.height=s;const h=M.getContext("2d");h.fillStyle="#000",h.fillRect(0,0,s,s);const i=(a,r)=>[(a+k)/(k*2)*s,(r+k)/(k*2)*s],R=a=>a.kind==="mainland"||a.maxRadius>120,u=(a,r)=>{const m=Math.max(1,a.radius||a.maxRadius||1);return R(a)?r===2?30:r===1?16:6:r===2?W(m*.7,24,52):r===1?W(m*.4,13,30):W(m*.12,3,9)},C=(a,r)=>{const m=Math.round(W(r,0,1)*255);h.fillStyle=`rgb(${m},${m},${m})`;for(const o of y){const t=Math.max(1,o.radius||o.maxRadius||1),w=1+a(o)/t;h.beginPath(),o.points.forEach((e,p)=>{const c=o.center.x+(e.x-o.center.x)*w,g=o.center.z+(e.z-o.center.z)*w,[d,n]=i(c,g);p===0?h.moveTo(d,n):h.lineTo(d,n)}),h.closePath(),h.fill()}};h.globalCompositeOperation="lighten";const v=[{level:2,width:11,v0:0,v1:.3,steps:10},{level:1,width:5.5,v0:.3,v1:.54,steps:8},{level:0,width:2.5,v0:.54,v1:.82,steps:6}];for(const a of v)for(let r=0;r<a.steps;r+=1){const m=r/(a.steps-1);C(o=>u(o,a.level)+a.width*(1-m*2),a.v0+(a.v1-a.v0)*m)}h.globalCompositeOperation="source-over";let l=M;for(let a=0;a<2;a+=1){const r=document.createElement("canvas");r.width=l.width/2,r.height=l.height/2,r.getContext("2d").drawImage(l,0,0,r.width,r.height),l=r}h.imageSmoothingEnabled=!0,h.drawImage(l,0,0,s,s),h.fillStyle="#fff";for(const a of y)h.beginPath(),a.points.forEach((r,m)=>{const[o,t]=i(r.x,r.z);m===0?h.moveTo(o,t):h.lineTo(o,t)}),h.closePath(),h.fill();const f=new ne(M);return f.wrapS=Y,f.wrapT=Y,f.generateMipmaps=!1,f.minFilter=I,f.magFilter=I,f.colorSpace=J,f.flipY=!1,f}function Me(y,{count:k=24,points:s=16,width:M=1,color:h=16777215,opacity:i=.4,minStep:R=1.4,taper:u="tail",wake:C=!1,foamNoise:v=null}={}){const l=new $({vertexColors:!0,transparent:!0,blending:C?fe:me,depthWrite:!1,toneMapped:!1,side:he});C&&v&&(l.defines={USE_UV:""},l.onBeforeCompile=e=>{e.uniforms.uFoamNoise={value:v},e.uniforms.uFoamTime={value:0},e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
varying vec2 vFoamXZ;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vFoamXZ = transformed.xz;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D uFoamNoise;
uniform float uFoamTime;
varying vec2 vFoamXZ;`).replace("#include <color_fragment>",`#include <color_fragment>
float wakeX = vUv.x * 2.0 - 1.0;
float wakeAx = abs(wakeX);
float wakeAge = vUv.y;
float wash = (1.0 - smoothstep(0.0, 0.72, wakeAx)) * pow(1.0 - wakeAge, 1.7);
float arm = smoothstep(0.55, 0.8, wakeAx) * (1.0 - smoothstep(0.86, 1.0, wakeAx)) * (1.0 - wakeAge * 0.55);
float wakeShape = min(wash * 1.15 + arm, 1.0);
float foamA = texture2D(uFoamNoise, vFoamXZ * 0.22 + vec2(uFoamTime * 0.03, -uFoamTime * 0.02)).x;
float foamB = texture2D(uFoamNoise, vFoamXZ * 0.8 - vec2(uFoamTime * 0.02, uFoamTime * 0.016)).y;
float wakeThresh = mix(0.32, 0.62, wakeAge);
float wakeSpeck = smoothstep(wakeThresh, wakeThresh + 0.26, foamA * 0.55 + foamB * 0.6);
float wakeBody = 0.3 * pow(1.0 - wakeAge, 2.0);
float wakeFade = diffuseColor.g;
diffuseColor.rgb = vec3(0.94, 0.98, 1.0);
diffuseColor.a = clamp(wakeShape * (wakeBody + wakeSpeck * 1.05) * wakeFade * 2.4, 0.0, 0.85);`),l.userData.shader=e},l.customProgramCacheKey=()=>"trail-wake-foam");const f=new D(h),a=2,r=[],m=new Map;function o(){const e=new de,p=new Float32Array(s*a*3),c=new Float32Array(s*a*3),g=new Float32Array(s*a*2);for(let b=0;b<s;b+=1)for(let S=0;S<a;S+=1)g[(b*a+S)*2]=S%2;e.setAttribute("position",new Z(p,3)),e.setAttribute("color",new Z(c,3)),e.setAttribute("uv",new Z(g,2));const d=[];for(let b=0;b<s-1;b+=1){const S=b*a,x=S+a;d.push(S,S+1,x,S+1,x+1,x)}e.setIndex(d),e.setDrawRange(0,0);const n=new U(e,l);return n.frustumCulled=!1,n.renderOrder=3,y.add(n),{mesh:n,geometry:e,history:[],live:null,lastPush:0,key:null}}for(let e=0;e<k;e+=1)r.push(o());const t=new ve;function w(e){const p=e.live?[e.live,...e.history]:e.history;let c=p;p.length>=3&&(t.points=p.map(x=>new E(x.x,x.y,x.z)),c=t.getPoints(s-1));const g=e.geometry.getAttribute("position"),d=e.geometry.getAttribute("color"),n=Math.min(c.length,s),b=(s-1)*R;let S=0;for(let x=0;x<n;x+=1){const T=c[x],z=c[Math.max(0,x-1)],H=c[Math.min(c.length-1,x+1)];let _=H.x-z.x,G=H.z-z.z;const O=Math.hypot(_,G)||1,ee=-G/O,ae=_/O;x>0&&(S+=Math.hypot(T.x-c[x-1].x,T.z-c[x-1].z));const A=Math.min(1,S/b),P=Math.pow(1-A,1.4)*i,N=x*a,te=e.geometry.getAttribute("uv");for(let F=0;F<a;F+=1)te.setY(N+F,A);const q=C?M*(.08+2.1*Math.pow(A,.8)):M*(u==="tail"?.35+A*.85:1-A*.5)*.5;for(const[F,L]of[[N,q],[N+1,-q]])g.setXYZ(F,T.x+ee*L,T.y,T.z+ae*L),d.setXYZ(F,f.r*P,f.g*P,f.b*P)}g.needsUpdate=!0,d.needsUpdate=!0,e.geometry.getAttribute("uv").needsUpdate=!0,e.geometry.setDrawRange(0,Math.max(0,(n-1)*6))}return{push(e,p,c,g,d){let n=m.get(e);if(!n){if(n=r.find(x=>x.key===null),!n)return;n.key=e,n.history=[],n.live=null,m.set(e,n)}n.lastPush=d;const b=n.history,S=b[0];S&&Math.hypot(p-S.x,g-S.z)>R*40&&(b.length=0),n.live={x:p,y:c,z:g},(!b[0]||Math.hypot(p-b[0].x,g-b[0].z)>=R)&&(b.unshift({x:p,y:c,z:g}),b.length>s-1&&b.pop()),w(n)},update(e){const p=l.userData.shader;p&&(p.uniforms.uFoamTime.value=e);for(const c of r){if(c.key===null||e-c.lastPush<.4)continue;const g=c.history,d=g[g.length-1],n=g[g.length-2];d&&n?(d.x+=(n.x-d.x)*.22,d.z+=(n.z-d.z)*.22,Math.hypot(n.x-d.x,n.z-d.z)<.08&&g.pop()):g.pop(),c.history.length<2?(m.delete(c.key),c.key=null,c.history=[],c.live=null,c.geometry.setDrawRange(0,0)):w(c)}},setVisible(e){for(const p of r)p.mesh.visible=e},dispose(){for(const e of r)e.geometry.dispose(),y.remove(e.mesh);l.dispose()}}}export{ke as a,Me as c,Se as g};
