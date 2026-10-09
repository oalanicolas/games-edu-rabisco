# Edu Rabisco — aprender é experimentar

Portal por matérias, inspirado no catálogo de Ryan Sael e construído com código,
arte e textos próprios. Amazonas e Terremotos vêm completos do Geografia Rabisco;
os demais cadernos têm maquetes 3D, controles, leituras, investigação guiada,
registros, exportação CSV, ficha imprimível e mediação de 30 minutos.

Catálogo completo de referência: `src/edu-inventory.json`, consultado em 08/10/2026.
Esta edição tem 61 aulas: 59 bancadas próprias e os dois cadernos do Geografia Rabisco.
Inclui 20 novas adaptações em Three.js a partir da curadoria de fontes além do Sael.
Dos 57 itens catalogados no Sael, 41 têm adaptação e 16 permanecem como referências.
O portal diferencia temas adaptados e referências externas ainda sem aula local.
Há filtros por Geografia, Física, Biologia, Química, Matemática, Tecnologia, Artes,
História e sociedade, Língua Portuguesa e Educação Física. As três últimas são
conexões interdisciplinares; não são cobertura completa do currículo.

## Abrir

Na raiz do workspace:

```sh
python3 framework/scripts/game.py serve apps/edu-rabisco
```

Instalação e verificações nesta pasta:

```sh
npm ci
npm run doctor
npm run qa
```

O servidor serve a produção em `dist/`; os recursos do portal não dependem do Sael.
`npm run dev` é o desenvolvimento. O destino público está declarado em
`workspace.json`: [edu.rabisco.net](https://edu.rabisco.net/). A publicação usa
`python3 framework/scripts/gameops.py deploy edu-rabisco` depois do push do módulo.
O recibo no hub registra o commit e a conferência efetiva da versão servida.

Para verificar o site público: `EDU_QA_URL=https://edu.rabisco.net/ npm run qa`.
Após comparar as capturas, remova as imagens e os pacotes exclusivos de QA,
inclusive cópias no Drive. Preserve resultados JSON/texto e recibo de limpeza.

## Usar em aula

Escolha uma matéria, pesquise um tema e abra o caderno. Os laboratórios começam
pausados. Mude uma variável de cada vez, registre duas configurações e compare
as leituras. Os ensaios guardam também o instante e as leituras daquele momento.
No caderno de ritmos, ative as palmas para ouvir uma gravação real, opcional.
Uma mudança reinicia e pausa o relógio; “Recomeçar” restaura os dois
controles. Arraste para girar a bancada e use a rolagem para aproximar.

A aba “Investigar e registrar” guarda até 12 configurações por aula nesta aba do
navegador. O texto livre não é enviado nem persistido; recarregar o apaga.
“Baixar registros” exporta apenas parâmetros e leituras em CSV.
“Imprimir ficha” inclui os ensaios registrados e as observações atuais.

Espere a confirmação de materiais offline em HTTPS ou localhost. Abra novamente
o mesmo endereço com a rede desligada antes de uma aula. Links externos exigem
conexão. Sem WebGL, leituras, controles, investigação e impressão continuam
disponíveis; a maquete é substituída por uma explicação textual.

## Proveniência e limites

Não são réplicas dos clientes Sael. Alguns temas são reinterpretados para uma
atividade mais simples; equações e limites estão no caderno e em `game-design.md`.
Dados de empresas, rankings de IA, usuários e custos atuais do site original
não foram importados. Os links preservam a autoria de Ryan Sael.

Nenhum piloto com turma real, certificação curricular ou teste em aparelho móvel
real foi realizado. A validação móvel é emulação no Chrome. Evidência e estado
de verificação: `QA.md`.

## Portabilidade em Three.js

`src/edu-ports.js` registra a coleção por matéria, referência e leitura de apoio.
`src/edu-port-models.js` calcula as relações e os estados determinísticos;
`src/edu-port-scenes.js` apresenta o mesmo instante com objetos Three.js.
São adaptações didáticas com código, arte e texto próprios, não reconstruções
integrais dos clientes originais. Nenhum cliente de licença restrita foi incorporado.
Modelos contínuos, horizontes, unidades e coeficientes assumidos ficam nos cadernos.
