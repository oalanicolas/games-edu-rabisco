import { portedModes, portState } from './edu-port-models.js';

export function model(mode, a, b, time = 0) {
  if(portedModes.has(mode))return portState(mode,a,b,time);
  const read = (label, value, unit = '') => ({ label, value, unit });
  let metrics = [], value = 0;
  switch (mode) {
    case 'pendulum': {
      const ta = 2 * Math.PI * Math.sqrt(a / 9.81), tb = 2 * Math.PI * Math.sqrt(b / 9.81);
      metrics = [read('Período A', ta, 's'), read('Período B', tb, 's'), read('Razão B / A', tb / ta, '×')]; value = tb / ta; break;
    }
    case 'prism': { const angle = Math.asin(Math.sin(a * Math.PI / 180) / b) * 180 / Math.PI; metrics = [read('Entrada', a, '°'),read('Dentro do vidro', angle, '°')]; value = angle; break; }
    case 'lens': { const image = a * b / (a - b); metrics = [read('Imagem a', image, 'cm'),read('Ampliação', image / a, '×')]; value = image; break; }
    case 'wave': metrics = [read('Comprimento de onda',343 / a,'m'),read('Amplitude', b,'%')]; value = 343 / a; break;
    case 'siphon': { const speed = Math.sqrt(2 * 9.81 * a), flow = Math.PI * (b / 1000) ** 2 * speed * 1000; metrics = [read('Velocidade ideal',speed,'m/s'),read('Vazão ideal',flow,'L/s')]; value = flow; break; }
    case 'magnet': { const r = Math.hypot(a,b), bx = 3 * a * a / r ** 5 - 1 / r ** 3, by = 3 * a * b / r ** 5; metrics = [read('Orientação',Math.atan2(by,bx)*180/Math.PI,'°'),read('Campo relativo',Math.hypot(bx,by))];value=Math.atan2(by,bx); break; }
    case 'maglev': value=Math.sqrt(b/(a*9.81));metrics=[read('Equilíbrio',value*100,'cm'),read('Peso',a*9.81,'N')];break;
    case 'brake': value=a*a/(2*b*9.81);metrics=[read('Distância ideal',value,'m'),read('Tempo de frenagem',a/(b*9.81),'s')];break;
    case 'rocket': value=a*b;metrics=[read('Empuxo',value/1000,'kN'),read('Momento transferido / s',value,'N')];break;
    case 'wind': value=.5*1.225*b*a*a;metrics=[read('Arrasto',value,'N'),read('Velocidade',a,'m/s')];break;
    case 'gears': { const inner=b*(a-.75)/a, outer=b*(a+.75)/a;metrics=[read('Roda interna',inner,'m/s'),read('Roda externa',outer,'m/s'),read('Diferença',outer-inner,'m/s')];value=outer-inner;break; }
    case 'lightning': value=a/b;metrics=[read('Campo médio',value,'kV/m'),read('Distância',b,'m')];break;
    case 'mirror': value=a*2;metrics=[read('Objeto–imagem',value,'m'),read('Posição lateral',b,'m')];break;
    case 'skate': value=a/(b*.0001)/1000000;metrics=[read('Pressão média',value,'MPa'),read('Área',b,'cm²')];break;
    case 'root': value=b/100;metrics=[read('Inclinação inicial',a,'°'),read('Resposta relativa',b,'%')];break;
    case 'heart': value=a*b/1000;metrics=[read('Débito',value,'L/min'),read('Duração da batida',60/a,'s')];break;
    case 'bird': value=a;metrics=[read('Batidas',a,'Hz'),read('Período da asa',1000/a,'ms'),read('Amplitude',b,'°')];break;
    case 'bubble': value=b*b*4*Math.PI;metrics=[read('Área da bolha',value,'cm²'),read('Espessura',a,'nm')];break;
    case 'crystal': value=1/(a*(1+b/100));metrics=[read('Tamanho relativo',value),read('Núcleos ilustrativos',Math.round(8*a*(1+b/100)))];break;
    case 'fusion': value=a*b/100-a;metrics=[read('Recuperada',a*b/100,'MJ'),read('Saldo',value,'MJ')];break;
    case 'tide': value=Math.sqrt(1+(b/100)**2+2*b/100*Math.cos(2*a*Math.PI/180));metrics=[read('Amplitude relativa',value),read('Ângulo',a,'°')];break;
    case 'aurora': value=75-a*.22;metrics=[read('Latitude ilustrativa',value,'°'),read('Energia relativa',b,'%')];break;
    case 'sky': value=1/Math.sin(a*Math.PI/180);metrics=[read('Percurso relativo',value,'×'),read('Partículas relativas',b,'%')];break;
    case 'flood': {const heights=Array.from({length:12},(_,i)=>b+(i%4)*.45+Math.floor(i/4)*.2);value=heights.filter(h=>a>h).length;metrics=[read('Casas atingidas',value,'/12'),read('Nível',a,'m')];break;}
    case 'terrain': value=Math.floor(a/b);metrics=[read('Curvas de nível',value),read('Topo',a,'m')];break;
    case 'graph': value=(a^b).toString(2).split('1').length-1;metrics=[read('Menor caminho',value,'arestas'),read('Vértices',8),read('Arestas',12)];break;
    case 'scale': value=(b/a)**3;metrics=[read('Razão dos lados',b/a,'×'),read('Razão das áreas',(b/a)**2,'×'),read('Razão dos volumes',value,'×')];break;
    case 'network': value=(2*a/200000+2*b*.002)*1000;metrics=[read('Ida e volta ideal',value,'ms'),read('Distância de ida',a,'km')];break;
    case 'tokens': value=a/b;metrics=[read('Tempo de geração',value,'s'),read('Tokens',a)];break;
    case 'datacenter': value=a*b/1000;metrics=[read('Potência total',value,'kW'),read('Calor / segundo',value,'kJ')];break;
    case 'energy': value=a*b/1000;metrics=[read('Energia consumida',value,'kWh'),read('Potência',a,'W')];break;
    case 'traffic': value=Math.max(0,a-30*b/100);metrics=[read('Crescimento da fila',value,'veíc./min'),read('Capacidade média',30*b/100,'veíc./min')];break;
    case 'robots': value=a/b;metrics=[read('Capacidade ideal',value*60,'tarefas/min'),read('Robôs',a)];break;
    case 'color': value=a+b;metrics=[read('Vermelho',a,'%'),read('Azul',b,'%')];break;
    case 'room': value=b/100;metrics=[read('Temperatura de cor',a,'K'),read('Intensidade',b,'%')];break;
    case 'architecture': value=2*Math.PI*a;metrics=[read('Percurso do pátio',value,'m'),read('Distância entre módulos',value/b,'m')];break;
    case 'orbital': value=2*Math.PI*Math.sqrt((6371+a)**3/398600)/60;metrics=[read('Período orbital',value,'min'),read('Satélites no plano',b)];break;
    case 'convection': value=(a-20)*(1+b/100);metrics=[read('Diferença térmica',a-20,'°C'),read('Abertura',b,'%'),read('Índice ilustrativo',value)];break;
    case 'pipeline': value=.2+a/b;metrics=[read('Tempo total hipotético',value,'s'),read('Geração',a/b,'s'),read('Espera fixa',.2,'s')];break;
    case 'conversation': value=a*(a+1)/2*b;metrics=[read('Entradas acumuladas',value,'tokens'),read('Saídas acumuladas',a*b,'tokens'),read('Entrada / saída',(a+1)/2,'×')];break;
    default: throw new Error(`Unknown model: ${mode}`);
  }
  return { metrics, value };
}
export function evaluateLesson(lesson, values, time = 0) {
  const { metrics, value } = model(lesson.mode, values.a, values.b, time);
  return { value, metrics: metrics.map(m => ({...m,label:m.label,unit:m.unit})) };
}
export const defaults = lesson => Object.fromEntries(lesson.controls.map(c => [c.id,c.value]));
export const format = (n, digits=2) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(n);
