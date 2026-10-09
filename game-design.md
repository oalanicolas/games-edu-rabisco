# Edu Rabisco — direção e contrato dos cadernos

## Direção vigente — 09/10/2026

Alan recusou as reimplementações simplificadas dos temas Sael e pediu download e
reutilização integral dos scripts públicos. O catálogo principal abre 57 clientes
originais. O programa, modelo, shaders, materiais, câmeras e controles de cada fonte
são preservados. O caderno educativo é acrescentado sobre o cliente, sem substituí-lo.
As 20 adaptações próprias de outras fontes ficam separadas. Os cadernos Geografia
Rabisco permanecem disponíveis. Não alegar que scripts e arte de Ryan Sael são próprios.

## Design system

Portal e caderno reutilizam marca Rabisco, papel, Barlow e Caveat do Geografia.
A cena preserva o acabamento da fonte. Não recriar maquetes, aplicar tema Rabisco à
cena original ou reduzir detalhe para aumentar FPS. Caderno fechado deixa a experiência
em tela inteira; no mobile seu botão fica fora do rodapé de controles original.

## Arquitetura e fidelidade

`public/acervo/manifest.json`: bytes recebidos, URLs, hashes, falhas registradas.
`src/edu-originals.json`: catálogo completo. `build-originals.mjs`: páginas locais.
`original-bridge.js`: remapeamento de recursos e observação do estado.
`original-notebook.js`: hipótese, registros reais, CSV/JSON, impressão e mediação.
Todas as simulações utilizam Three.js. 56 fontes já usam a biblioteca. Sky mantém seu
programa e shaders WebGL, com uma fachada de renderização Three.js; só a expressão
que cria o contexto é trocada. Os testes verificam a preservação dos demais scripts.
A exceção é documentada e não significa identidade binária da página integrada.

A captura não inclui servidores privados, presença de usuários, rádio autenticado,
clima ou consultas DNS como serviços próprios. Esses limites aparecem no caderno.
Dados de rankings e outros snapshots não representam atualização em tempo real.
Não fabricar serviços, números de usuários ou respostas para simular funcionalidade.

## Ciclo de aula

Pergunta → hipótese → controle original → consequência → registro → comparação.
Os ensaios guardam as leituras e o estado do cliente original, não cálculos substitutos.
Até 12 ensaios ficam nesta aba; texto livre só em memória. Caderno em português;
idioma original da experiência preservado. Professor identifica grandezas e limites
usando também a ajuda do autor. Sem alegar certificação ou piloto pedagógico.

## Decisões tomadas sem Alan

- Preservar brutos com hashes e integrar somente rotas, caderno e telemetria.
- Manter coleção própria separada e compatibilidade das rotas antigas de aula.
- Portar apenas a superfície de desenho WebGL do Sky; conservar shaders e controles.
- Preservar dados de captura e declarar serviços externos, sem inventar servidor.

## Prova e pendências

`doctor`: todos os hashes e scripts internos, modelos próprios e build de produção.
`qa`: 57 clientes originais no desktop/mobile emulado, controles nativos principais,
registros e rotas; 20 adaptações próprias e cadernos herdados verificados separadamente.
Publicação via gameops, commit servido e assets conferidos por hash.
Aceite visual de Alan, piloto com turma e aparelho móvel real ainda não realizados.

## Histórico

A edição anterior implementou 41 temas Sael com modelos próprios e 20 adaptações de
outras fontes. Essa direção foi recusada para a coleção Sael; modelos antigos continuam
nos arquivos históricos, mas nenhuma rota principal Sael abre essas maquetes.
