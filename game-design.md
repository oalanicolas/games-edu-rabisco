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
- Preparar destino público; manter publicação pendente de pedido explícito de push/deploy.

## Prova e pendências

`doctor` confere relações, parâmetros e produção. `qa` percorre o conjunto completo
no navegador, incluindo casos sem rede e sem WebGL. As capturas devem ser lidas em
prancha com as referências. Uma imagem ou gate não declara aprovação de Alan.
Pendências: aceite visual, piloto pedagógico, dispositivo móvel real e publicação.
