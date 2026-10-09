# Verificação — Edu Rabisco

Produção verificada em 08/10/2026. Fonte dos números: relatório gerado por
`npm run qa` em `<repo-root>/output/edu-rabisco/qa/report.json`.

- `npm run doctor`: 13/13 testes; build Vite 7.3.7 e pacote offline aprovados.
- `npm run qa`: 50/50 cenários, nenhuma exceção ou resposta local HTTP de erro.
- Coleção: 41/41 aulas acessíveis; 39/39 laboratórios novos exercitados com os
  dois controles, passo, início, pausa, restauração, registros e recarga.
- Referência: 57/57 itens catalogados; 41 adaptados, 16 referências externas.
- Amazonas e Terremotos: os dois laboratórios WebGL e os seis cadernos herdados
  acessíveis, preservando o módulo original.
- Teclado, abas, impressão com ensaios, CSV e configuração inválida verificados.
- Offline: todas as 41 aulas acessíveis com rede desligada após instalação.
- WebGL ausente: investigação, controles, leituras e impressão continuam funcionando.
- Catálogo e todas as aulas em largura 390 px: sem transbordamento horizontal.
  Mobile emulado; não testado em aparelho real.
- Renderer: `ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Ultra, Unspecified Version)`.
- 42 capturas, ficha PDF e revisão visual da coleção. Arte própria inspirada
  nos temas; sem alegação de réplica visual do Sael ou aprovação de Alan.
- `npm audit`: nenhuma vulnerabilidade após atualizar Vite para 7.3.7.

## Correções dos verificadores

O teste inicial de controle acumulava duas alterações: em enchentes, o cenário
já saturado não reagia à segunda variável. Cada controle agora é testado desde
o estado inicial, mantendo a exigência de mudança nas leituras. Grafos recebe
o extremo diferente do valor inicial; o máximo já era o padrão. A checagem
offline procura o título visível, pois a ficha imprimível tem outro título
oculto. Nenhum limiar físico foi relaxado.

## Revisão visual

39/39 bancadas inspecionadas na folha de contato; portal desktop/mobile e quatro
pares com a referência revistos em resolução de uso. A legenda “pulmões” foi
reposicionada para ficar inteira na câmera inicial; a captura final foi relida
e o ciclo completo de verificação repetido após a correção.

Diferenças assumidas nos pares (Sael à esquerda, Edu Rabisco à direita):

1. Bancada de papel Rabisco e interface de caderno em lugar do cenário original.
2. Maquetes próprias esquemáticas, com menos detalhe e regimes físicos cobertos.
3. Duas variáveis por investigação, ensaios, ficha e roteiro docente em português.

Não constituem prova de paridade ou aprovação. Os pares preservam a referência
identificada e deixam as diferenças visíveis durante a revisão. Após a conferência,
as capturas temporárias e os pacotes de QA são apagados; ficam resultados e recibos.

## Limites e publicação

Modelos didáticos com simplificações explícitas; sem previsão, diagnóstico,
certificação curricular ou piloto em turma. História, Português e Educação
Física têm conexões interdisciplinares. Não representam um currículo completo.
As 16 referências externas ainda não têm laboratório independente neste portal.

Destino público: `edu.rabisco.net`. O recibo de publicação registra a versão
e a conferência no domínio; `EDU_QA_URL` permite repetir o ciclo nesse endereço. O servidor local
é aberto pelo comando do README; portas e endereço saem da execução, não são fixos.

Pesquisa e fontes: `docs/pesquisas/Edu Rabisco — laboratórios visuais por matéria a partir do Sael.md`
no hub. Capturas ficam fora do Git e são apagadas após comparação, assim como
pacotes exclusivos de QA e suas cópias no Drive. Resultados e recibos permanecem.

## Portabilidade — comparação numérica

O novo check de leitura no mesmo instante comparava doubles com igualdade exata
entre Node e Chrome. A bússola retornou 60,4612177404419 e
60,46121774044192 graus, diferença de arredondamento da biblioteca matemática.
A comparação agora exige rótulos e unidades idênticos e erro até
1e−10 × max(1, |valor esperado|), muito abaixo da precisão exibida. Essa mudança
de assertiva trata aritmética entre runtimes, não relaxa conservação, finitude,
controle ou igualdade do instante. Os testes físicos permanecem inalterados.

## Leva de portabilidade — 09/10/2026

- Doctor: 23/23 testes, produção e offline aprovados.
- QA local: 73/73 cenários; 61/61 aulas, 59/59 bancadas, 20/20 adaptações novas.
- Membrana, osmose, cinética e energia conservadas nos regimes declarados.
- Leis dos circuitos, órbita e trilateração conferidas; populações positivas e
  tráfego sem interpenetração. Bandos com bordas periódicas e semente fixa.
- Ensaios evolutivos preservam o instante, números, CSV, recarga e impressão.
- Palma decodificada e reproduzida somente após ativação e reprodução; pausa,
  avanço manual e silenciamento não criam novos sons. Sem avaliação auditiva humana.
- Nenhum iframe em todas as bancadas locais. Todos usam renderer Three.js.
- 61/61 aulas offline; coleção integral sem overflow a 390 px emulados.
- Renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Ultra, Unspecified Version). Não testado em aparelho real.
- Pranchas temporárias e comparação do portal antes/depois; diferença principal:
  novo conteúdo e contagem, preservando identidade, hero e bancadas anteriores.
- Correções visuais: legenda do DNA movida para a base e texto de trilateração
  encurtado; rótulos adaptam o corpo da fonte à largura da textura.
- Capturas retornam ao topo da página para comparar a mesma composição.
  Relógio e leituras são atualizados juntos no avanço manual.

O recibo no hub registra o commit, os recursos servidos e a conferência do domínio.
Use `EDU_QA_URL=https://edu.rabisco.net/ npm run qa` para conferir a produção.
