window.__EDU_SKY_GL__ = canvas => {
  const THREE=window.__THREE_LIB.three,C=WebGLRenderingContext;
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.autoClear=false;renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.Camera(),geometry=new THREE.BufferGeometry();
  const mesh=new THREE.Mesh(geometry);mesh.frustumCulled=false;scene.add(mesh);
  let program=null,buffer=null,texture=null,unit=0;const textures=new Map();
  const uniform=(name,value)=>{program.material.uniforms[name]={value};};
  const gl={};
  for(const name of ['ARRAY_BUFFER','CLAMP_TO_EDGE','COLOR_BUFFER_BIT','COMPILE_STATUS','DYNAMIC_DRAW','FLOAT','FRAGMENT_SHADER','LINEAR','LINK_STATUS','NEAREST','REPEAT','RGBA','SCISSOR_TEST','TEXTURE0','TEXTURE1','TEXTURE2','TEXTURE_2D','TEXTURE_MAG_FILTER','TEXTURE_MIN_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','TRIANGLES','UNSIGNED_BYTE','VERTEX_SHADER'])gl[name]=C[name];
  Object.assign(gl,{
    createShader:type=>({type,text:''}),shaderSource:(shader,text)=>shader.text=text,compileShader(){},getShaderParameter:()=>true,getShaderInfoLog:()=>'',deleteShader(){},
    createProgram:()=>({shaders:[],types:{}}),attachShader:(p,shader)=>p.shaders.push(shader),
    linkProgram(p){
      const vertex=p.shaders.find(s=>s.type===C.VERTEX_SHADER).text,fragment=p.shaders.find(s=>s.type===C.FRAGMENT_SHADER).text;
      for(const match of (vertex+'\n'+fragment).matchAll(/uniform\s+(\w+)\s+(\w+)/g))p.types[match[2]]=match[1];
      p.material=new THREE.RawShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{},depthTest:false,depthWrite:false,toneMapped:false});mesh.material=p.material;
    },
    getProgramParameter:()=>true,getProgramInfoLog:()=>'',useProgram:p=>program=p,
    createBuffer:()=>({array:null,interleaved:null}),bindBuffer:(target,value)=>buffer=value,
    bufferData(target,value){buffer.array=typeof value==='number'?new Float32Array(value/4):new Float32Array(value);},
    getAttribLocation:(p,name)=>name,enableVertexAttribArray(){},
    vertexAttribPointer(name,size,type,normalized,stride,offset){
      if(!buffer.interleaved)buffer.interleaved=new THREE.InterleavedBuffer(buffer.array,stride/4||size).setUsage(THREE.DynamicDrawUsage);
      const attribute=new THREE.InterleavedBufferAttribute(buffer.interleaved,size,offset/4,normalized);geometry.setAttribute(name,attribute);if(name==='a')geometry.setAttribute('position',attribute);
    },
    bufferSubData(target,offset,data){buffer.array.set(data,offset/4);buffer.interleaved.needsUpdate=true;},
    getUniformLocation:(p,name)=>name,uniform1f:uniform,uniform2f:(name,x,y)=>uniform(name,new THREE.Vector2(x,y)),
    uniform1i(name,value){uniform(name,program.types[name]?.startsWith('sampler')?textures.get(value):value);},
    createTexture:()=>new THREE.DataTexture(),activeTexture:value=>unit=value-C.TEXTURE0,
    bindTexture(target,value){texture=value;textures.set(unit,value);},
    texParameteri(target,pname,value){
      const convert={[C.NEAREST]:THREE.NearestFilter,[C.LINEAR]:THREE.LinearFilter,[C.CLAMP_TO_EDGE]:THREE.ClampToEdgeWrapping,[C.REPEAT]:THREE.RepeatWrapping};
      const property={[C.TEXTURE_MIN_FILTER]:'minFilter',[C.TEXTURE_MAG_FILTER]:'magFilter',[C.TEXTURE_WRAP_S]:'wrapS',[C.TEXTURE_WRAP_T]:'wrapT'}[pname];texture[property]=convert[value];
    },
    texImage2D(target,level,internal,width,height,border,format,type,data){texture.image={data,width,height};texture.needsUpdate=true;},
    texSubImage2D(target,level,x,y,width,height,format,type,data){texture.image.data.set(data);texture.needsUpdate=true;},
    viewport(x,y,width,height){renderer.setSize(width,height,false);renderer.setViewport(x,y,width,height);},
    enable:flag=>{if(flag===C.SCISSOR_TEST)renderer.setScissorTest(true);},disable:flag=>{if(flag===C.SCISSOR_TEST)renderer.setScissorTest(false);},
    scissor:(x,y,width,height)=>renderer.setScissor(x,y,width,height),clearColor:(r,g,b,a)=>renderer.setClearColor(new THREE.Color(r,g,b),a),clear:()=>renderer.clear(),
    drawArrays(mode,first,count){geometry.setDrawRange(first,count);renderer.render(scene,camera);},
  });
  window.__EDU_SKY_THREE__={renderer,scene,geometry,shaderSource:()=>program?.shaders.map(s=>s.text),textures};
  addEventListener('pagehide',()=>{geometry.dispose();mesh.material.dispose();for(const t of textures.values())t.dispose();renderer.dispose();},{once:true});
  return gl;
};
