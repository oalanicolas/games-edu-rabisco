# Edu Rabisco

Portal educativo em PT-BR, superfície Aprender. Destino: `edu.rabisco.net`.
Código e arte próprios; referência de perguntas em `src/edu-inventory.json`.

- Cânone e decisões: `game-design.md`; instruções de abertura e estado: `README.md`.
- `npm run doctor`: relações físicas, catálogo, modelos herdados e build de produção.
- `npm run qa`: todas as aulas, controles, registros, teclado, impressão, mobile emulado e offline.
- Servir pelo hub: `python3 framework/scripts/game.py serve apps/edu-rabisco`.
- QA headless com Chrome e GPU Metal; `QA_HEADED=1` somente quando solicitado.
- API de QA: `window.__EDU__.observe()`, `set(id, valor)`, `advance(segundos)`; portal: `window.__EDU_HOME__`.
- Capturas em `output/edu-rabisco/qa` do hub, nunca no Git. Após comparação, apagar capturas e pacotes de QA locais e no Drive; preservar resultados JSON/texto e recibo de limpeza.
- `EDU_QA_URL=https://edu.rabisco.net/ npm run qa` verifica a produção pública; sem essa variável, abre o servidor local oficial.
- Amazonas e Terremotos foram reutilizados do módulo Rio Amazonas, commit `0e38e7a33d69`; a origem permanece preservada.
- Distinguir laboratório local e referência externa. Números de cobertura saem de contagem sobre a coleção inteira.
- Movimento pode ser desacelerado ou ampliado. Leituras físicas declaram unidade; índices fictícios são explícitos.
- Não tratar modelos didáticos como previsão, diagnóstico ou projeto de engenharia.
- Sem contas ou envio de respostas. Textos de observação ficam em memória; `sessionStorage` só contém configurações dos ensaios.
- GTM `GTM-TT2J9B4B` somente no domínio público. Recursos de runtime e fontes ficam locais.
- Manter a identidade Rabisco: marca, papel e Caveat reutilizados; cores, maquetes e cadernos definidos neste módulo.
- Publicação pelo fluxo `gameops deploy edu-rabisco`, após push autorizado. Não apresentar URL pública como publicada antes da conferência.

## Recusado por Alan

Nenhuma recusa específica registrada para este portal.

## Aprovação visual

O pedido autoriza a criação. Não há mensagem de aceite visual ou piloto em turma.
