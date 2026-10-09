# Edu Rabisco — experiências originais por matéria

Portal educativo em PT-BR. Catálogo principal: 57 clientes publicados por Ryan Sael,
capturados em 09/10/2026 e integrados com seus scripts, shaders, arte, modelos e controles.
As 20 adaptações próprias de outras referências estão em uma coleção separada.
Cadernos completos Amazonas e Terremotos continuam acessíveis separadamente.

## Abrir e verificar

Pelo hub: `python3 framework/scripts/game.py serve apps/edu-rabisco`.
Nesta pasta: `npm ci`, `npm run doctor`, `npm run qa`.
Produção: [edu.rabisco.net](https://edu.rabisco.net/).
`EDU_QA_URL=https://edu.rabisco.net/ npm run qa` verifica a versão servida.
Publicação: `python3 framework/scripts/gameops.py deploy edu-rabisco`, após push autorizado.

## Reutilização e autoria

`public/acervo/` preserva os arquivos capturados, byte a byte, com hashes e proveniência
em `manifest.json`. `src/edu-originals.json` identifica os 57 projetos.
`public/originais/` contém as páginas integradas, produzidas por
`scripts/build-originals.mjs`: remapeamento para recursos locais, retirada da telemetria
externa e acréscimo do caderno Rabisco. Não requer o módulo Swipe para compilar.
Os scripts originais de simulação continuam inteiros. Não são maquetes reimplementadas.

56 clientes já usam Three.js. Sky usava WebGL direto: seus shaders, parâmetros e controles
foram conservados; `original-sky-three.js` executa as mesmas chamadas com WebGLRenderer,
RawShaderMaterial, InterleavedBuffer e DataTexture de Three.js. O teste compara todo
script interno com a fonte e permite apenas a troca da criação do contexto do Sky.
Arquivos brutos e avisos de autoria originais permanecem preservados.
O modelo, arte e programas originais são de Ryan Sael. O portal e o caderno são do Edu Rabisco.

## Usar em aula

Abra uma experiência e explore seus controles originais. “Caderno da aula” acrescenta
Entender, Investigar e Professor em português sem substituir o simulador.
Registre dois estados reais, compare suas leituras e exporte CSV ou JSON.
Até 12 registros ficam no sessionStorage desta aba. O texto livre fica somente na página,
não é enviado e desaparece ao recarregar. A impressão inclui as observações atuais.
As rotas antigas de aulas Sael redirecionam para os clientes originais correspondentes.
Os controles e textos originais continuam no idioma publicado pelo autor.

## Captura e limites

A captura contém 1084 recursos, incluindo 91 arquivos JavaScript externos e todos os
scripts internos das 57 páginas. Os hashes são verificados no `doctor`.
38 requisições da origem falharam durante a captura; estão listadas no manifest,
incluindo recomendações/OG inexistentes, telemetria e uma consulta DNS.
A captura do cliente público não contém os servidores privados do autor.
Presença, clima, consultas de rede, dados ao vivo e rádio externo podem exigir internet
ou não funcionar fora da origem. Dados preservados correspondem à data da captura.
O cache guarda os arquivos locais; não torna esses serviços independentes da rede.
Não declarar o site inteiro 100% independente ou todas as suas ações verificadas.

Nenhum piloto com turma, aceite visual de Alan ou teste em aparelho móvel real foi feito.
Os testes de desktop e mobile emulado, limites observados e cobertura constam em `QA.md`.
Após inspecionar capturas, apagá-las; conservar somente resultados JSON/texto e recibos.

## Outros laboratórios

As 20 adaptações próprias usam `edu-ports.js`, `edu-port-models.js` e
`edu-port-scenes.js`. Mantêm modelos, controles, exportação e fichas próprios.
Não são clientes originais das referências citadas. O Geografia reutiliza o módulo
Rio Amazonas, commit `0e38e7a33d69`, com recursos locais e cadernos preservados.
