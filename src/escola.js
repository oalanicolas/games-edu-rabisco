import { prepareOffline } from './offline.js';
const tabs = [...document.querySelectorAll('.school-tabs a')];
function openChapter() {
  const selected = ['estudar', 'atividades', 'professor'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'estudar';
  document.querySelectorAll('.chapter').forEach(section => { section.hidden = section.id !== selected; });
  tabs.forEach(tab => { if (tab.hash === `#${selected}`) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); });
}
addEventListener('hashchange', openChapter);
tabs.forEach(tab => tab.addEventListener('click', event => { event.preventDefault(); location.hash = tab.hash; openChapter(); }));
openChapter();
const zoom = document.querySelector('#map-zoom');
zoom.addEventListener('input', () => {
  document.querySelector('#official-map').style.width = `${Number(zoom.value) * 100}%`;
  document.querySelector('#map-zoom-value').textContent = `${zoom.value}×`;
});
const questions = document.body.dataset.lesson === 'terremotos' ? [
  ['Mudar a frequência da mesa é o mesmo que mudar a magnitude de um terremoto?', ['Sim: hertz mede magnitude.', 'Não: frequência é o ritmo; magnitude caracteriza o evento.', 'Sim: uma torre alta aumenta a magnitude.'], 1, 'Frequência indica ciclos por segundo. Magnitude caracteriza o tamanho de um sismo; intensidade descreve efeitos e tremor em um local.'],
  ['Por que uma torre pode oscilar mais em certo ritmo?', ['A vibração pode se aproximar de sua frequência natural.', 'Todo prédio alto sempre cai.', 'A cor da fachada amplifica o sismo.'], 0, 'Na ressonância, a excitação se aproxima da frequência natural. Altura, rigidez e amortecimento alteram a resposta; segurança real depende de muitos outros fatores.'],
  ['O Brasil pode ter terremotos?', ['Não, porque está longe de muitos limites de placas.', 'Só se uma placa aparecer de repente.', 'Sim, também ocorrem sismos no interior das placas.'], 2, 'Muitos sismos ocorrem perto de limites, mas falhas no interior das placas também podem se movimentar. O Brasil não é livre de sismos.'],
  ['Um mesmo terremoto provoca o mesmo efeito em todos os lugares?', ['Sim, sempre.', 'Não: distância, solo e construções influenciam os efeitos.', 'Só a frequência decide todos os danos.'], 1, 'Magnitude se refere ao evento; intensidade varia de lugar para lugar. Exposição e vulnerabilidade também participam do risco urbano.'],
  ['O laboratório permite concluir que…', ['uma torre real está certificada como segura.', 'a próxima data de um terremoto está prevista.', 'podemos comparar respostas do modelo, reconhecendo seus limites.'], 2, 'O modelo é elástico, simplificado e sem dados de uma cidade. Não calcula ruptura, danos, magnitude nem segurança de edifícios.']
] : [
  ['Em um meandro, onde tende a ocorrer maior erosão?', ['Na margem externa da curva.', 'Na margem interna da curva.', 'Sempre nas duas margens por igual.'], 0, 'A corrente tende a retirar material na margem externa; a interna favorece a deposição. São tendências, não uma regra para todo ponto do rio.'],
  ['Ao comparar cheia e vazante na mesma etapa, o que investigamos?', ['A idade da floresta.', 'A mudança no nível da água e na área inundada.', 'A distância real de migração em 300 anos.'], 1, 'A comparação dos ciclos mostra a conexão entre canal e planície inundável. As etapas do modelo não equivalem a anos.'],
  ['O mapa da ANA exibido neste caderno representa…', ['o estado do Amazonas inteiro e apenas ele.', 'a bacia internacional completa.', 'a Região Hidrográfica Amazônica brasileira.'], 2, 'O mapa mostra uma divisão hidrográfica brasileira que inclui áreas de sete estados; a bacia internacional ultrapassa o Brasil.'],
  ['Água naturalmente barrenta permite concluir que…', ['ela é própria para beber.', 'ela está sempre contaminada.', 'sedimentos podem estar presentes; a aparência não determina sua qualidade.'], 2, 'Material transportado pelo rio pode dar cor barrenta à água. Potabilidade e contaminação exigem outras informações.'],
  ['Qual conclusão é válida a partir do diorama?', ['Podemos comparar processos ilustrados e discutir seus limites.', 'Uma cidade real será inundada na etapa 240.', 'O rio terá exatamente o mesmo formato daqui a 300 anos.'], 0, 'O modelo ajuda a explorar conceitos, mas não tem coordenadas nem dados para prever cheias e mudanças reais.']
];
const answers = new Map();
const quiz = document.querySelector('#quiz');
questions.forEach(([question, options, correct, explanation], i) => {
  const field = document.createElement('fieldset');
  const legend = document.createElement('legend'); legend.textContent = `${i + 1}. ${question}`; field.append(legend);
  options.forEach((option, j) => {
    const label = document.createElement('label'); const radio = document.createElement('input'); radio.type = 'radio'; radio.name = `question-${i}`; radio.value = j;
    label.append(radio, document.createTextNode(option)); field.append(label);
    radio.addEventListener('change', () => {
      answers.set(i, j === correct); feedback.hidden = false; feedback.dataset.correct = String(j === correct); feedback.textContent = `${j === correct ? 'Isso mesmo.' : 'Retome o conceito e tente novamente.'} ${explanation}`;
      document.querySelector('#quiz-status').textContent = `${answers.size} de ${questions.length} perguntas respondidas · ${[...answers.values()].filter(Boolean).length} respostas corretas agora.`;
    });
  });
  const feedback = document.createElement('p'); feedback.className = 'feedback'; feedback.hidden = true; feedback.setAttribute('role', 'status'); field.append(feedback); quiz.append(field);
});
const recordsElement = document.querySelector('#records');
function renderRecords() {
  let records = [];
  try { records = JSON.parse(sessionStorage.getItem('atlas-amazonas-records') || '[]'); } catch { records = []; }
  records = Array.isArray(records) ? records.filter(r => r && typeof r === 'object' && ['margens', 'cheias'].includes(r.activity) && ['dry', 'normal', 'flood'].includes(r.season) && ['stage', 'flow', 'sediment', 'flooded', 'sinuosity'].every(k => Number.isFinite(r[k]))).slice(-12) : [];
  recordsElement.replaceChildren();
  if (!records.length) { recordsElement.textContent = 'Nenhum registro ainda. Abra um experimento e use “Registrar observação”.'; return; }
  const wrap = document.createElement('div'); wrap.className = 'records-wrap'; const table = document.createElement('table'); table.className = 'records-table';
  const caption = table.createCaption(); caption.textContent = 'Comparações do modelo ilustrativo';
  const headers = table.createTHead().insertRow(); ['Experimento', 'Etapa', 'Ciclo', 'Corrente / 100', 'Sedimento / 100', 'Área inundada no modelo', 'Sinuosidade'].forEach(text => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; headers.append(th); });
  const body = table.createTBody(); const names = { dry: 'Vazante', normal: 'Transição', flood: 'Cheia' };
  records.forEach(r => { const row = body.insertRow(); [r.activity === 'margens' ? 'Margens' : 'Cheias', r.stage, names[r.season], r.flow, r.sediment, `${r.flooded}%`, r.sinuosity.toFixed(2).replace('.', ',')].forEach(value => { row.insertCell().textContent = value; }); });
  wrap.append(table); recordsElement.append(wrap);
}
if (recordsElement) {
  renderRecords();
  document.querySelector('#clear-records').addEventListener('click', () => { try { sessionStorage.removeItem('atlas-amazonas-records'); } catch {} renderRecords(); });
}
document.querySelector('#print-guide').addEventListener('click', () => { document.querySelectorAll('#professor details').forEach(d => { d.open = true; }); window.print(); });
prepareOffline(document.querySelector('#offline-status'));
