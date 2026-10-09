(() => {
  const source=window.__EDU_SOURCE__,bridge=window.__EDU_ORIGINAL__;
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=document.createElement('section');root.id='edu-notebook';
  root.innerHTML=`<div class="edu-body" id="edu-body" hidden><div class="edu-nav"><a href="/">Voltar às matérias</a><button id="edu-close" aria-label="Fechar caderno">Fechar</button></div><h2>${escape(source.title)}</h2><p>${escape(source.summary)}</p><p class="edu-credit">Experimento original: <a href="${escape(source.source)}" target="_blank" rel="noreferrer">Ryan Sael</a>. Caderno: Edu Rabisco. Captura: 09/10/2026.</p><div class="edu-tabs" role="tablist" aria-label="Caderno de aula"><button role="tab" data-edu-tab="entender" aria-controls="edu-entender" aria-selected="true">Entender</button><button role="tab" data-edu-tab="investigar" aria-controls="edu-investigar" aria-selected="false">Investigar</button><button role="tab" data-edu-tab="professor" aria-controls="edu-professor" aria-selected="false">Professor</button></div><section id="edu-entender" role="tabpanel"><h3>${escape(source.question)}</h3><p>${escape(source.explanation)}</p><p>Explore os controles da experiência original, mova a câmera e compare suas vistas. O caderno registra as leituras e o estado desse simulador.</p><p class="edu-limit">${escape(source.limit)}</p></section><section id="edu-investigar" role="tabpanel" hidden><h3>Uma hipótese. Dois ensaios.</h3><p>${escape(source.challenge)}</p><label for="edu-notes">Minha hipótese e o que observei</label><textarea id="edu-notes" placeholder="Eu imagino que… Ao mudar…"></textarea><p class="edu-status">Observações só nesta página. A impressão inclui o texto. Os ensaios ficam nesta aba, sem envio.</p><button id="edu-record">Registrar estado original</button><div id="edu-records"></div><div class="edu-actions"><button id="edu-csv" disabled>Baixar CSV</button><button id="edu-json" disabled>Baixar JSON</button><button id="edu-print-button">Imprimir ficha</button><button id="edu-clear">Limpar ensaios</button></div><p id="edu-status" class="edu-status" role="status"></p></section><section id="edu-professor" role="tabpanel" hidden><h3>Da pergunta à explicação</h3><ol><li>Peça uma previsão antes de operar a cena.</li><li>Identifique os controles e as grandezas da experiência original.</li><li>Compare duas configurações, mudando uma condição de cada vez.</li><li>Registre as leituras do simulador e discuta as evidências.</li><li>Consulte a explicação original e seus limites.</li></ol><p>O cliente preserva o modelo, a arte, as câmeras e os efeitos publicados pelo autor. Dados e serviços ao vivo podem exigir conexão. Não houve piloto com turma ou teste em aparelho móvel real.</p><button id="edu-teacher-print">Imprimir ficha</button></section></div><button id="edu-open" class="edu-launch" aria-expanded="false" aria-controls="edu-body"><img src="/marca/rabisco.webp" alt="Rabisco">Caderno da aula</button>`;
  document.body.append(root);const print=document.createElement('section');print.id='edu-print';document.body.append(print);
  const dock=()=>{
    const launch=root.querySelector('#edu-open'),width=launch.offsetWidth,height=launch.offsetHeight;
    const controls=[...document.querySelectorAll('button,input,select,a,[role="button"]')].filter(el=>!root.contains(el)&&el.getClientRects().length).map(el=>el.getBoundingClientRect());
    for(const ratio of [.46,.32,.62,.18,.78])for(const right of [true,false]){
      const x=right?innerWidth-width-12:12,y=Math.min(innerHeight-height-12,Math.max(12,innerHeight*ratio));
      if(controls.some(r=>x<r.right+8&&x+width>r.left-8&&y<r.bottom+8&&y+height>r.top-8))continue;
      launch.style.left=x+'px';launch.style.right='auto';launch.style.top=y+'px';return;
    }
  };
  addEventListener('resize',dock);setTimeout(dock,200);setTimeout(dock,1800);
  const query=new URLSearchParams(location.search),key=`edu-original-${source.slug}`;
  let records=[];try{const stored=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(stored))records=stored.filter(r=>r&&typeof r.at==='string'&&typeof r.readings==='string'&&r.sourceHash===source.sourceHash).slice(-12);}catch{}
  const panel=name=>{for(const button of root.querySelectorAll('[data-edu-tab]')){const selected=button.dataset.eduTab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;root.querySelector(`#edu-${button.dataset.eduTab}`).hidden=!selected;}};
  const open=value=>{root.querySelector('#edu-body').hidden=!value;root.querySelector('#edu-open').setAttribute('aria-expanded',String(value));};
  root.querySelector('#edu-open').onclick=()=>open(root.querySelector('#edu-body').hidden);root.querySelector('#edu-close').onclick=()=>open(false);
  for(const [i,button] of [...root.querySelectorAll('[data-edu-tab]')].entries()){
    button.onclick=()=>panel(button.dataset.eduTab);
    button.onkeydown=event=>{const tabs=[...root.querySelectorAll('[data-edu-tab]')];let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(next!==undefined){event.preventDefault();tabs[next].focus();panel(tabs[next].dataset.eduTab);}};
  }
  const readings=()=>{
    const ids=['s-a','s-b','s-c','st-h','stats','readout','metrics','hud-stats'];
    return ids.map(id=>document.getElementById(id)?.innerText?.trim()).filter(Boolean).join('\n')||document.querySelector('.stats,.readouts,.numbers')?.innerText?.trim()||'Consulte o estado original registrado abaixo.';
  };
  const snapshot=()=>({at:new Date().toISOString(),source:source.source,sourceHash:source.sourceHash,readings:readings(),state:bridge.observe(),controls:[...document.querySelectorAll('input,select')].filter(n=>!root.contains(n)&&!['email','password','hidden'].includes(n.type)).map(n=>({id:n.id,type:n.type,value:n.value}))});
  const render=()=>{root.querySelector('#edu-records').innerHTML=records.map((r,i)=>`<article class="edu-record"><strong>Ensaio ${i+1}</strong><p class="edu-readings">${escape(r.readings)}</p><small>${escape(r.at)}</small><details><summary>Estado do simulador</summary><pre class="edu-readings">${escape(JSON.stringify(r.state.debug||r.state.model||r.controls,null,2))}</pre></details></article>`).join('');for(const id of ['edu-csv','edu-json'])root.querySelector('#'+id).disabled=!records.length;};
  const persist=()=>{try{sessionStorage.setItem(key,JSON.stringify(records));}catch{root.querySelector('#edu-status').textContent='Armazenamento indisponível: os ensaios ficam só nesta página.';}render();};
  root.querySelector('#edu-record').onclick=()=>{records.push(snapshot());records=records.slice(-12);persist();root.querySelector('#edu-status').textContent=`${records.length} ensaio(s) do simulador original registrado(s).`;};
  root.querySelector('#edu-clear').onclick=()=>{records=[];persist();};
  const download=(extension,type,content)=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=`edu-${source.slug}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  root.querySelector('#edu-json').onclick=()=>download('json','application/json',JSON.stringify({source,records},null,2));
  root.querySelector('#edu-csv').onclick=()=>{const rows=[['ensaio','registrado_em','leituras_originais','estado_original'],...records.map((r,i)=>[i+1,r.at,r.readings,JSON.stringify(r.state)])];download('csv','text/csv;charset=utf-8','\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(';')).join('\n'));};
  const preparePrint=()=>{print.innerHTML=`<h1>${escape(source.title)}</h1><p>${escape(source.question)}</p><h2>Minha hipótese e observações</h2><p>${escape(root.querySelector('#edu-notes').value).replaceAll('\n','<br>')}</p><h2>Ensaios do simulador original</h2>${records.map((r,i)=>`<article><strong>Ensaio ${i+1}</strong><pre>${escape(r.readings)}</pre><p>${escape(r.at)}</p></article>`).join('')||'<p>Ensaio A: ____________________<br>Ensaio B: ____________________</p>'}<h2>O que mudou? O que explica a diferença?</h2><p>________________________________________________________________</p><p>${escape(source.limit)}</p><p>Modelo e arte: Ryan Sael · ${escape(source.source)}<br>Caderno: Edu Rabisco.</p>`;};
  for(const id of ['edu-print-button','edu-teacher-print'])root.querySelector('#'+id).onclick=()=>{preparePrint();window.print();};addEventListener('beforeprint',preparePrint);
  if(['entender','investigar','professor'].includes(query.get('caderno'))){panel(query.get('caderno'));open(true);}
  render();
  const ready=setInterval(()=>{
    const renderer=window.__x?.renderer||window.__datCity?.renderer;
    if(typeof window.__dbg==='function'||renderer||window.__EDU_SKY_THREE__?.renderer||document.querySelector('canvas')?.width>0){bridge.ready=true;clearInterval(ready);window.__lab?.tune?.({auto:0});}
  },100);
  window.__EDU_NOTEBOOK__={snapshot,records:()=>records,open,panel,source};
})();
