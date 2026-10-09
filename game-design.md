# Edu Rabisco — direção e contrato dos cadernos

## Visão

Pedido de Alan em 08/10/2026: criar mais experimentos como Geografia Rabisco,
organizados por tipos de aula, aproveitando o catálogo Sael em `edu.rabisco.net`.
Superfície: Aprender. Escala: product. Plataforma: navegador com mouse, toque e teclado.
Fantasia: uma bancada de curiosidades em que o estudante formula uma hipótese,
altera uma condição e reúne evidências para explicar um fenômeno.

O ciclo é pergunta → hipótese → ajuste → consequência → registro → comparação → explicação.
O professor usa os mesmos cadernos, com roteiro e critérios; não há conta, nota ou servidor de respostas.

## Reaproveitar, adaptar e criar

Reaproveitados: marca Rabisco, papel, Barlow e Caveat do Geografia Rabisco,
seus arquivos de fonte com licença, código dos dois laboratórios e modelos,
mapas e fotos com proveniência, cadernos e fichas.
Origem: `prototypes/rio-amazonas`, commit `0e38e7a33d69`.
O módulo original não foi alterado; os recursos necessários estão neste módulo.

Adaptados: registro e cache offline para o portal, navegação e metadados do novo domínio.
Criados: catálogo e busca por matérias, cadernos parametrizados, modelos matemáticos,
maquetes, prévias renderizadas das próprias cenas, exportação e impressão.
A lacuna era a ausência de um portal e de laboratórios locais para as demais matérias.

Pesquisa: `docs/pesquisas/Edu Rabisco — laboratórios visuais por matéria a partir do Sael.md`.
Inventário integral: `src/edu-inventory.json`. Cada referência se mantém identificada
como tema adaptado ou link externo; não é uma captura full do site.

## Design system

Papel claro com textura do acervo, tinta verde escura, azul para comparação,
laranja para contraste. Georgia nos títulos, Barlow na leitura, Caveat nas
anotações. Marca original, sem regeneração. As bancadas próprias têm tablado
quadriculado, luz suave, sombra real, massas sólidas e rótulos legíveis.
O acabamento não substitui a leitura da variável: o número vem do modelo;
o movimento é declarado ampliado ou desacelerado quando necessário.

## Arquitetura

### Portabilidade aprovada em 09/10/2026

Alan pediu apenas Three.js e autorizou converter o que for possível. Escala:
product, superfície Aprender. Reutilizar renderizador, materiais, tablado,
fontes, caderno, controles, ensaios, impressão e offline. Criar modelos e cenas
para temas ausentes. Todas as bancadas locais usam Three.js; Canvas 2D serve
somente à textura dos rótulos, sem motor externo ou iframe de simulação.

Escopo verificável desta leva: difusão, osmose, reação, DNA, frações,
probabilidade, balança algébrica, funções, predador-presa, bandos, trânsito em
anel, realimentação, ritmo, circuito em série, circuito paralelo, órbita elíptica,
trilateração, engrenagens, montanha-russa e ressonância em tubo. Fontes de
perguntas já pesquisadas: Concord, Polypad, GeoGebra, Complexity, LOOPY,
Chrome Music Lab, Falstad, NASA, Bartosz e myPhysicsLab. Código, arte e texto
próprios; sem transcrever clientes de licença não confirmada. Portabilidade de
modelos e interação, não réplica integral de cada aplicativo nem de todo acervo.

Hipótese de experiência: se a cena e a leitura dependem do mesmo estado, mudar
uma variável ajuda a relacionar causa e consequência. Refuta-se por leituras
divergentes, movimento sem relação com parâmetro ou reinício não reprodutível.
Modelos evolutivos usam um relógio determinístico; seus ensaios guardam também
o instante, permitindo comparar, recarregar e imprimir a mesma observação.
Coeficientes hipotéticos e desaceleração visual constam nos limites de cada aula.
Ritmo usa gravação CC0 de palma do acervo, somente após ação explícita, com
som opcional e sem efeitos em prévias. Sem substituição da identidade vigente.

Aceite: todos os novos temas têm bancada 3D própria, dois controles operantes,
fonte, pergunta, desafio, leituras coerentes com o instante, pausa/reinício,
registro, ficha e offline; percorrer também a coleção anterior. Não inventar
aprovação humana, fidelidade integral, piloto ou desempenho em telefone real.

Vite 7.3.7, Three.js 0.183.2, npm com lockfile. Vite herdado foi atualizado de 7.1.7
após audit indicar falhas corrigidas na mesma versão principal; sem troca de engine.
`edu-catalog.js`: conteúdo e parâmetros. `edu-models.js`: relações matemáticas puras.
`edu-scene.js`: maquetes e animações. `edu-home.js`: catálogo e prévias.
`edu-lesson.js`: caderno, registros e mediação. Os modelos legados permanecem separados.

Os modelos quantitativos incluem pêndulo de pequeno ângulo, Snell na primeira
interface, lente delgada, v = fλ, escoamento ideal por desnível, campo dipolar,
frenagem constante, empuxo por momento, arrasto quadrático, pressão média,
débito cardíaco, maré de equilíbrio, grafo do cubo, razão cúbica, órbita circular,
potência × tempo e capacidade média de filas. Cada um declara suas hipóteses.
Raízes, cristais, auroras, atmosfera, convecção e trajetórias de asas usam aproximações
qualitativas próprias. Não confundir índice ilustrativo com grandeza calibrada.

Parâmetros e tempo entram por controles. Mudar parâmetro pausa e reinicia o tempo.
Em WebGL indisponível, o modelo numérico permanece operante. Registros são validados
na leitura de sessionStorage, recalculados pelo modelo e limitados a 12.
O cache inclui todas as páginas e assets, trata query da aula pelo mesmo documento
e muda de nome a cada hash novo do conteúdo.

## Conteúdo e autoridade

As referências inspiram perguntas; não autorizam copiar cliente, arte ou explicação.
Equações conhecidas são implementadas de forma independente. Não importar dados vivos
de usuários, benchmarks e empresas sem um dossiê específico de fonte e atualização.
História, Português e Educação Física usam conexões e debates explicitados, sem
inventar marcos históricos, atribuições curriculares ou benefícios clínicos.

## Decisões tomadas sem Alan

- Portal independente, preservando o Geografia Rabisco publicado.
- Reutilizar stack e assets próprios; não embutir o cliente externo.
- Priorizar todas as experiências da categoria Explainers e temas transversais com
  modelos locais estáveis; mundos e dados vivos restantes permanecem como referências.
- Sem áudio automático ou contas. Mediação de 30 minutos para os novos cadernos.
- Publicação autorizada por Alan nesta conversa (“Faça deploy”); cada atualização
  precisa de conferência no domínio antes da entrega.

## Prova e pendências

`doctor` confere relações, parâmetros e produção. `qa` percorre o conjunto completo
no navegador, incluindo casos sem rede e sem WebGL. As capturas devem ser lidas em
prancha com as referências. Uma imagem ou gate não declara aprovação de Alan.
Pendências: aceite visual, piloto pedagógico e dispositivo móvel real.
A publicação e o commit servido são registrados no recibo do hub.
