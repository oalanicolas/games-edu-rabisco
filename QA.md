# Verificação — Edu Rabisco

Correção dos clientes originais em 09/10/2026.

- Integridade: 1076/1076 recursos e 95 scripts externos preservados por SHA-256.
- Programas internos: todos os scripts de 57/57 clientes comparados com a captura; Sky permite apenas criação do renderizador Three.js.
- Desktop: 57/57 clientes originais; mobile emulado: 57/57.
- 5 verificações adicionais: controles de bússola/prisma/sifão, registros e rota antiga.
- Coleção própria: 20/20 aulas, 34 cenários sem erro JavaScript ou HTTP local.
- `gates edu-rabisco --run`: build, test e doctor aprovados; 26 testes.
- Comparação fonte/local: bússola, prisma e sifão, vista Studio e timestamp fixo, resolução 1440×1050; câmeras iguais. Leituras de campo, prisma e vazão coincidentes. Partículas não sincronizadas antes da fixação podem variar.

Relatórios no hub: `output/edu-rabisco/qa-originals/local-report.json`,
`qa-originals/report.json`, `qa/report.json`, `pares/report.json`.
A conferência pública do commit e dos assets é produzida pelo gameops deploy.

## Defeitos retornados e regressões

- Maquetes simplificadas no lugar de scripts originais: teste de todas as páginas e todos os hashes.
- Caderno cobria controles: posicionamento que evita controles nativos; cliques na vista Studio e nos botões Pause/Play exercitados.
- Normalização de URL perdia a integração ao recarregar: ponte de history; Sky e Airace recarregam na rota original local.
- Captura pegava fade de transição: aguardar a vista concluir antes da screenshot.
- Testes de carimbo e tubo vazio observavam antes da atualização: avançar o simulador original antes de exigir consequência; nenhuma asserção foi afrouxada.

## Limites

38 requisições da origem falharam durante a captura; o manifest as preserva.
Backends privados, presença, clima, DNS e rádio continuam dependências externas.
Testes não cobrem toda combinação de parâmetros nem certificam o site inteiro 100% funcional.
Cliente preservado não significa backend replicado; os dados são snapshots.
Mobile foi emulado: não testado em aparelho real. Sem aceite visual de Alan ou piloto em turma.
Capturas temporárias serão apagadas após inspeção; JSON/texto e recibos permanecem.

- Dat City: a verificação pública detectou nove dependências tardias ausentes; agora exige todos os 64 bairros com `contentKind=dat-city.district`, sem aceitar dados sintéticos de fallback. Captura inclui 64 histórias e os 64 atlas da versão fixada.

- Navegação Dat City: 64 páginas “Open story” preservadas integralmente, com hidratação da versão original, gráfico e prévia Three.js. Conferência de todas as 64 páginas em desktop e mobile emulado.
- A origem desliga os dados publicados em localhost (`city-app.DTEwABxB.js`, `no()`): QA local usa `edu-qa.test` apontado ao servidor do projeto. O original tem 65 bairros configurados: 64 no manifesto público e o bairro local Curated Commons. A asserção compara a configuração original inteira, em vez de supor que os totais dos dois catálogos são iguais.

- Índice “All stories” e sete músicas públicas do Dat City preservados localmente; leituras e imagens de bairros conferidas também após o carregamento completo em mobile.

- Fontes do índice Dat City: stylesheet precisa responder com CSS, além de HTTP 200. Não aceitar HTML de fallback como arquivo de fonte carregado.

- Todas as 24 prévias relacionadas usam mídias originais arquivadas da mesma experiência; as origens antigas redirecionam a endereços removidos. Conferência pública inclui respostas tardias no total de falhas, além da atribuição por página.

- URLs locais já convertidas: uma URL absoluta do acervo conserva seu endereço quando passa novamente pela ponte; nunca duplicar `/acervo/` nem aceitar HTML como mídia.
