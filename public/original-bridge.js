(() => {
  const source = window.__EDU_SOURCE__;
  const files = window.__EDU_NETWORK__;
  const pages = window.__EDU_PAGES__;
  const hosts = new Set(Object.keys(files).map(url => new URL(url).host));
  const telemetry = /(?:dat\.d1\.tel|a\.d1\.tel|cloudflareinsights\.com|\/cdn-cgi\/rum)/;
  const errors = [];
  const local = (value, navigation = false) => {
    if (typeof value !== 'string' || /^(?:data:|blob:|#|mailto:|tel:)/.test(value)) return value;
    if (value.startsWith('/acervo/') || value.startsWith('/originais/') || value.startsWith('/original-') || value.startsWith('/stats.js')) return value;
    let url = new URL(value, source.source);
    if(url.origin===location.origin&&(url.pathname.startsWith('/acervo/')||url.pathname.startsWith('/originais/')||url.pathname.startsWith('/original-')||url.pathname==='/stats.js'))return url.href;
    if (url.origin === location.origin) url = new URL(url.pathname + url.search + url.hash, source.source);
    if (navigation) {
      if (url.origin === 'https://sael.net' && url.pathname === '/') return '/';
      const page = pages[url.origin + url.pathname.replace(/\/$/, '')];
      if (page) return page + url.search + url.hash;
    }
    const exact = files[url.href.replace(/#.*$/, '')];
    if (exact) return exact + url.hash;
    const atlas=url.host==='story-data.dat.city'&&url.pathname.match(/^\/story-data\/versions\/[^/]+\/assets\/story-atlases\/([^/]+\.webp)$/);
    if(atlas){const current=files[`https://story-data.dat.city/story-data/versions/20260903T060326Z/assets/story-atlases/${atlas[1]}${url.search}`];if(current)return current;}
    const poster=url.host==='sael.net'&&url.pathname.match(/^\/([^/]+)\/poster\.webp$/);
    if(poster){const slug=poster[1]==='ai-mall'?'a-muse-ment':poster[1],archived=files[`https://sael.net/p/${slug}/poster.webp`];if(archived)return archived;}
    if (hosts.has(url.host)) return '/acervo/' + url.host + url.pathname + url.search + url.hash;
    return value;
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (telemetry.test(value)) return Promise.resolve(new Response(null, {status:204}));
    const mapped = local(value);
    const request = input instanceof Request ? new Request(new URL(mapped, location.origin), input) : mapped;
    return originalFetch(request, options).then(response => {
      if (!response.ok) errors.push({url:value,status:response.status});
      return response;
    });
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) { return open.call(this, method, local(String(url)), ...args); };
  const css=value=>typeof value==='string'?value.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g,(match,quote,url)=>`url(${quote}${local(url.trim())}${quote})`).replace(/@import\s*(['"])([^'"]+)\1/g,(match,quote,url)=>`@import ${quote}${local(url)}${quote}`):value;
  const srcset=value=>String(value).startsWith('data:')?value:String(value).split(',').map(item=>{const [url,...size]=item.trim().split(/\s+/);return [local(url),...size].join(' ');}).join(',');
  const property=CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty=function(name,value,priority){return property.call(this,name,css(value),priority);};
  for(const name of ['background','backgroundImage']){
    const descriptor=Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype,name);
    if(descriptor?.set)Object.defineProperty(CSSStyleDeclaration.prototype,name,{...descriptor,set(value){descriptor.set.call(this,css(value));}});
  }
  for(const type of [Element,ShadowRoot]){
    const inner=Object.getOwnPropertyDescriptor(type.prototype,'innerHTML');
    Object.defineProperty(type.prototype,'innerHTML',{...inner,set(value){
      if(typeof value==='string'&&!['edu-notebook','edu-print'].includes(this.id)&&!this.closest?.('#edu-notebook,#edu-print'))value=css(value.replace(/\b(src|href|poster)=(['"])([^'"<>]+)\2/g,(match,name,quote,url)=>`${name}=${quote}${local(url.replaceAll('&amp;','&'),name==='href')}${quote}`));
      inner.set.call(this,value);
    }});
  }
  for (const [type, property] of [[HTMLImageElement,'src'],[HTMLImageElement,'srcset'],[HTMLScriptElement,'src'],[HTMLMediaElement,'src'],[HTMLVideoElement,'poster'],[HTMLSourceElement,'src'],[HTMLSourceElement,'srcset'],[HTMLLinkElement,'href'],[HTMLIFrameElement,'src'],[HTMLAnchorElement,'href']]) {
    const descriptor = Object.getOwnPropertyDescriptor(type.prototype, property);
    if (!descriptor?.set) continue;
    Object.defineProperty(type.prototype, property, {...descriptor,set(value){descriptor.set.call(this,property==='srcset'?srcset(value):local(String(value),type === HTMLAnchorElement));}});
  }
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name,value) {
    if ((name === 'src' || name === 'href' || name === 'poster') && typeof value === 'string') value = local(value, this instanceof HTMLAnchorElement);
    if(name==='srcset'||name==='imagesrcset')value=srcset(value);
    return setAttribute.call(this,name,value);
  };
  for(const method of ['pushState','replaceState']){
    const original=history[method].bind(history);
    history[method]=(state,title,url)=>{
      if(url==null)return original(state,title,url);
      const resolved=new URL(String(url),location.href);
      if(resolved.pathname.startsWith('/originais/'))return original(state,title,resolved.href);
      const mapped=local(String(url),true);
      const target=mapped.startsWith('/originais/')?mapped:`/originais/${source.slug}/${resolved.search}${resolved.hash}`;
      return original(state,title,target);
    };
  }
  window.__EDU_ORIGINAL__ = {source,errors,local,ready:false,observe(){const renderer=window.__x?.renderer||window.__datCity?.renderer||window.__EDU_SKY_THREE__?.renderer||window.renderer;return {source:source.source,sourceHash:source.sourceHash,engine:renderer?.isWebGLRenderer || renderer?.isWebGPURenderer ? 'three' : source.engine,debug:typeof window.__dbg === 'function' ? window.__dbg() : null,model:['compass-field','siphon-lab'].includes(source.slug)?window.__lab?.model():null,render:renderer?.info?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null,errors:[...errors]};}};
})();
