# Auditoria de render — os 191 sinais no avatar 3D

**Data:** 2026-11-01 · **Método:** fotografar o avatar a executar cada sinal, e medir
onde os ossos realmente vão parar — não o que a notação diz.

## Por que este teste existiu

Até aqui, a fidelidade era julgada comparando **a string de notação** de cada palavra
(`aponta mao frente`) com o fotograma do vídeo de referência. Esse método nunca testou
o **output**. Se o renderizador deforma uma notação correcta, o livro anterior dizia
«igual» e continuava errado. Esta auditoria compara o **pixel** com o vídeo.

## Ferramentas

| ferramenta | o que faz |
|---|---|
| `tools/folha-3d.cjs` | Chrome headless + WebGL por software; para cada palavra monta o beat pela rota real do site (`sinalNotacao → SINAL3D.sequencia → AVATAR.poseParaQuats`), congela, lê o canvas e cola numa folha com etiqueta. `--todos` → 32 folhas; `--alfabeto --maos` → close-ups das 26 letras. |
| `tools/sonda-alcance.cjs` | Para cada palavra e cada instante, lê a posição no mundo do punho, a normal da palma e o ângulo dos 55 ossos. Compara com o alvo pedido por `SINAL3D.ancoras()`. Calcula a distância de trajectória entre todos os pares de sinais (191²). |
| `tools/analisa-alcance.cjs` | Resume o ficheiro anterior nas tabelas abaixo. |
| `tools/colisoes.cjs` | Agrupa palavras cuja notação produz um tuple idêntico. |
| `tools/fonte/auditoria-render.json` | Veredicto por palavra, gerado das medições. |

Fotografias em `~/glb-lab/folhas/folha-01..32.png` e `~/glb-lab/alfa/folha-01..03.png`
(ficheiros de laboratório, fora do repositório).

## Estado depois das correcções A

As secções seguintes descrevem o renderizador **como ele estava** quando esta
auditoria foi feita, e continuam a ser o registo do que motivou o trabalho. O que já
foi corrigido, medido com as mesmas ferramentas:

| medida | antes | agora |
|---|---|---|
| sinais em que o punho não chega ao alvo pedido (＞3 cm) | 3 (`baixo`, 0,136 m) | **0** (p90 e máximo 0,02 m) |
| sinais a 1 mão com o local `mao` e a mão-parceira longe (＞18 cm) | 41 (0,43 m) | **0** (mediana 10,6 cm entre pulsos) |
| sinais de 2 mãos em que as mãos não se tocam no `telhado` | 7 de 58 | apenas `igreja` continua `mãos-não-tocam` |
| sinais em que a palma vira ＜5° | 171 | **23** |
| sinais em que a mão não roda nem na palma nem nos dedos | — | **15** |
| sinais imóveis (corpo ＜12° entre as pontas) | 17 | **13** (meses e objectos `parado`) |
| pares de sinais com as **mãos** a ＜10° (média de 32 ossos, mundo) | — | **241** pares; 59 abaixo de 3° |

O que mudou no código:

1. **A palma passou a ser do sinal** — `AJUSTES[].palma` sobrepõe-se ao lugar; o campo
   `esq` dá a mão esquerda assimétrica. Os lugares `baixo`/`barriga`/`mao` ganharam
   palmas próprias.
2. **A mão-parceira existe** — no lugar `mao` a mão esquerda é uma palma aberta em
   frente (`PARCEIRA`), e o deslocamento do movimento é amortecido a 35% para o dedo
   não escorregar da palma.
3. **O tronco inclina-se antes do IK** — sem isso o ombro não chegava aos alvos baixos
   e o braço esticava.
4. **O `rolar` roda em torno da normal da palma** — antes rodava em Z do mundo
   *depois* de assentar a palma, e desfazia-a: era isto que punha a mão da parceira de
   cutelo (a mão vertical em cima da palma em `estudar`, `escrever`, `ler`, `ajudar`).
5. **A distância entre sinais passou a medir-se nas mãos e no mundo** — a média pelos
   55 ossos era dominada pelo tronco (dois sinais com mãos diferentes davam ＜8°), e o
   quaternião local não via para onde a mão está virada. Também passou a comparar a
   trajectória inteira (5 amostras), não só as pontas: um movimento que vai e volta
   acaba onde começou.

## Custo e enquadramento das folhas (instrumento, não conteúdo)

Três mudanças na forma de fotografar, todas medidas com a linha de tempos do
`folha-3d.cjs` (guião · disco · pose · rAF · cópia · célula). A célula é 270×350.

| o que se mudou | antes | depois |
|---|---|---|
| `Page.captureScreenshot` (compositor) por folha | **546,2 s** | — (removido) |
| exportação da folha, um `toDataURL` de um canvas 2D | — | **0,0 s** (dentro do guião) |
| codificação PNG por pose do palco (`toDataURL` + `Image`) | **0,0 s** medidos | 0,0 s — *não era este o custo* |
| desenho das células | 1,3 s | 1,5 s |
| folha de 4 poses | **413,8 s** (103 s/pose) | **11,5 s** (2,9 s/pose) |
| CPU total durante a folha (`typeperf "\Processor(_Total)\% Processor Time" -sc 8`) | 84 → 100 % | **100 %** em 7 de 8 amostras, 34,1 % na última (saída) |

A conclusão que a medição impõe: o custo não estava no encode por pose (0,0 s) nem na
prioridade (com `BelowNormal` e afinidade 7 de 4 threads, a folha levou 103 s/pose);
estava em **içar o estado WebGL até ao compositor do Chrome** para o fotografar. A folha
já é um canvas 2D completo, por isso passa a sair de lá directamente: uma folha, um PNG.
Fica a nota de que o CPU total ainda marca 100 %: a máquina tem 2 núcleos físicos e o
Windows conta os 4 threads lógicos, e o trabalho é CPU-bound; o que mudou foi a duração
(11,5 s em vez de 413,8 s), não o pico.

**Enquadramento.** A janela de recorte é uma fracção da **largura do canvas do palco**
(`0,42 × 0,29`, altura `0,97`), definida à razão de referência 1000×700. A 400×520 o
palco da página deixa de ter a razão 10:7 e a mesma fracção passa a apanhar outro pedaço
do mundo: a figura saía pequena, com margem em volta, e as formas de mão — a única razão
destas folhas existirem — ficavam mais difíceis de ler. O tamanho da janela volta a ser
o de referência (1000×700) e o recorte volta a ser exactamente o da `folha-03.png`;
conferido a olho: a figura corre de baixo do bordo superior até abaixo das ancas, ~310
dos 350 px da célula, como nas folhas anteriores.

## F · `varre` cruza os antebraços (defeito actual — correcção PROPOSTA, não aplicada)

`app/maos.js:1039` define o movimento com um deslocamento lateral positivo:

```
varre: [[0.34, 0, 0.06], [0, -16, -10]]
```

`poseEm` escala esse vector por `AMPL.varre = 0,75`, o que dá **+0,255 m em X** para a mão
que assina. Nos três sinais `2:…varre` a segunda mão é o espelho exacto, logo as duas
andam em sentidos opostos **atravessando o meio do corpo**:

| sinal | notação | x inicial | x final (mão que assina) | cruza o meio |
|---|---|---|---|---|
| `mesa` | `2:plano frente varre` | −0,16 m | **+0,095 m** | 9,5 cm |
| `teto` | `2:plano telhado varre` | −0,15 m | **+0,105 m** | 10,5 cm |
| `chão` | `2:plano barriga varre` | −0,10 m | **+0,155 m** | 15,5 cm |

Nenhum outro sinal tem `2:` com `varre`; `nunca` (`B frente varre`) e `ler` (`aponta mao
varre`) são de uma mão e não sofrem disto. O resultado visível nas folhas 09–10 é o mesmo
nos três: no fim do movimento os antebraços formam um **X** à frente do corpo (em `teto`,
por cima da cabeça), em vez de varrerem para fora.

**Correcção proposta** (uma condição em `poseEm`, `app/sinal3d.js`, antes de somar `d`):

```js
/* num sinal espelhado a varredura é para fora: a componente lateral que
   aponta para o meio do corpo inverte-se */
if (b.duas && d[0] && Math.sign(d[0]) !== Math.sign(L.mao[0])) d[0] = -d[0];
```

Efeito: os três sinais passam a abrir as mãos para fora e nenhum antebraço cruza o meio.
Não toca em mais nada — a condição só dispara em `b.duas` com deslocamento lateral
contrário ao lado da mão, que hoje são exactamente estes três casos. Alternativas
rejeitadas: mudar a notação para `abre` (perde a leitura de «varrer» que
`borracha`/`preto` usam) e autorar keyframes por sinal (é o plano B, não a primeira
correcção de um erro de sinal).

**Verificação, quando for aprovada:** voltar a fotografar `mesa`, `teto` e `chão` com
`--palavras=mesa,teto,chão --out=…` e confirmar a olho que (a) os antebraços já não se
cruzam e (b) cada mão acaba do seu lado do corpo. A sonda de alcance deve continuar a
dar erro ao alvo ＜3 cm nesses três.


## Números (antes das correcções A)

| medida | valor |
|---|---|
| palavras na tabela | 191 |
| tuples de notação distintos | 160 → **57 palavras (30%) partilham a notação exacta com outra** |
| pares de sinais com a **mesma animação** (＜8° de diferença média por osso) | **2059** |
| palavras com pelo menos uma gémea | **187 / 191 = 98%** |
| sinais em que o corpo inteiro muda **＜12°** entre o primeiro e o último passo | **17** |
| sinais a 1 mão cujo local pede uma segunda mão, e a mão parada está a 43–48 cm | **41** |
| sinais de 2 mãos em que as mãos chegam a tocar-se (＜12 cm) | **7 de 58** |
| sinais em que a palma vira ＜5° durante todo o movimento | **171 / 191** |
| erro entre o alvo do `local` e onde o punho chega | **0,000 m** em 14 dos 15 locais; só `baixo` falha (0,136 m, 3 sinais) |
| mão ou dedos dentro de 26 cm do esterno | **0** — não há encravamento no torso |

Amplitude média por movimento, em graus somados nos 55 ossos:
`varre 119 · arco 110 · abre 105 · baixo 98 · frente 96 · cima 91 · bate 57 · repete 55 ·
tras 53 · circulo 40 · toque 34 · onda 23 · torce 18 · parado 0`.

## O que está errado, e porquê

Cinco limites **do renderizador**, não das strings. Todos comprovados por leitura de
código em `app/sinal3d.js`.

### A · A palma pertence ao LUGAR, não ao sinal
`sinal3d.js:90` — `palma: L.palma`. A orientação da palma vem só do `local`. `frente`
obriga a palma para a câmara (65 sinais), `peito` obriga a palma para o corpo (26).
Não há maneira de dizer «palma para cima», «palmas uma contra a outra», «palma para a
esquerda».
**Consequência visível:** `casa` devia ter as palmas viradas uma para a outra a formar
telhado; sai com as duas palmas para a câmara. `dar` devia ter a palma para cima a
oferecer; sai com a palma no peito, que é «eu/meu» — por isso `dar` é igual a `bom`,
`obrigado`, `mau`, `feliz`, `filho`, `cinza`, `chamo-me`. (Curiosidade: `teto` e
`igreja` ficam bons porque o local `telhado` já traz palma para baixo — a forma certa,
por sorte, não por escolha.)
**E torna 4 letras do alfabeto impossíveis:** `P` é «K virado para baixo» e `Q` é «G
para baixo»; sem controlo da palma, P≡K e Q≡G.

### B · A mão-parceira não existe
`sinal3d.js:76` — quando `duas` é falso, a mão esquerda é estacionada num sítio fixo
`[0.30, 1.02, 0.17]` com forma `curva`, **independentemente do sinal**. O local `mao`
aponta para `[-0.05, 1.226, 0.30]`. As duas coisas nunca se encontram: a distância
medida é 0,43 m nos 40 sinais `mao`.
**Consequência:** 41 sinais (21%) são uma mão a gesticular sobre ar vazio — `mês`,
`semana`, `hora`, `ler`, `escrever`, `comprar`, `vender`, `pagar`, `médico`,
`hospital`, `computador`, `dinheiro`, `estudar`, `ajudar`, `velho`, `novo`, `rápido`,
`arroz`, `pão`, `sal`, `borracha`, `lição`, `cadeira`, `julho`, `cedo`, `chegar`.
O caso mais claro é `ajudar`: em IS é um punho pousado na palma aberta que sobe. Sem a
palma, é um punho a flutuar junto anca. `semana` é «descrever um círculo na palma do
outra mão» — o círculo é feito no ar.

### C · O movimento é pequeno demais para se ler
O deslocamento é escalado por `ESC_MOV = 0.37` (`sinal3d.js:11`). Resultado medido:
`toque` desloca o punho 3,6 cm, `torce` 2,1 cm, `onda` 2,3 cm. Os 13 sinais `parado`
não mudam **nada** — as duas fotografias são bit-a-bit iguais.
**Consequência:** 6 meses do ano (`março`, `abril`, `junho`, `setembro`, `novembro`,
`dezembro`) são fotografias paradas. `pé` muda 0,9° em todo o corpo.

### D · As duas mãos são sempre espelhadas
`sinal3d.js:80-85` — a segunda mão é `[-x, y, z]` da primeira, com a **mesma forma** e o
**mesmo movimento**. De 58 sinais a duas mãos, só 7 chegam a tocar-se.
**Consequência:** não há sinal assimétrico possível. `comprar` (a mão pega em moedas da
palma), `ler` (uma mão segura, a outra vira a página), `nunca`, `laranja`, `ajudar`
não são expressáveis. `andar` precisa de um dedo a caminhar sobre a palma da outra mão;
saem dois dedos paralelos no ar.

### E · O vocabulário de formas é estreito demais
`plano` 50 + `aponta` 37 = **46% do léxico são duas formas de mão**. `aponta` leva
polegar a 24/36/40°, por isso lê-se como «L» e não como índice — 37 sinais. `abre` não
abduz os dedos o suficiente e lê-se como mão plana — 15 sinais.
No alfabeto, medido a close-up: **só ~9 de 26 letras são legíveis** (A, C, E, L, K, M,
S, X, Y). B sai com os dedos afastados (deveriam estar juntos); U e V são a mesma mão;
M e N são a mesma mão; F e O não formam anel; H e W não se distinguem; I, J, Z, P, Q
falham por orientação ou movimento.

## Colisões exactas (mesma string → mesma animação)

| pose partilhada | palavras |
|---|---|
| `aponta mao frente` | caneta · lápis · feijão · pagar |
| `plano peito baixo` | mau · filho · filha |
| `aponta frente torce` | não · verde · roxo |
| `2:plano frente abre` | caderno · livro · grande |
| `plano peito frente` | bom · dar |
| `aponta queixo frente` | responder · dever |
| `aponta boca baixo` | vermelho · rosa |
| `curva boca torce` | laranja · fruta |
| `abre boca circulo` | cores · bonito |
| `2:plano frente parado` | carteira · quarto |
| `2:punho frente bate` | trabalhar · sapato |
| `aponta mao circulo` | semana · hora |
| `aponta olho toque` | olho · nariz |
| `plano mao toque` | mão · hospital |
| `curva mao frente` | arroz · legumes |
| `aponta mao toque` | escrever · dedo |
| `abre alto onda` | olá · tchau |
| `aponta frente frente` | ir · ali |
| `2:plano frente baixo` | agora · mercado |
| `2:plano frente repete` | lento · devagar |
| `F frente torce` | quanto custa · fevereiro |
| `2:X mao bate` | amigo · amiga |
| `2:aponta frente bate` | irmão · irmã |
| `plano queixo frente` | obrigado · obrigada |
| `curva boca repete` | comer · comida |
| `C boca cima` | beber · bebida |

Além destas, a medição de trajectória encontrou colisões que a string não mostra. Os
casos mais próximos, medidos par a par:

| par | diferença | porque colidem |
|---|---|---|
| `teto` ≡ `igreja` | 2,24° | mesma forma de telhado; `igreja` é `parado`, logo uma fotografia |
| `bom` ≡ `dar` | 0,00° | ambos «palma ao peito» |
| `semana` ≡ `hora` | 0,00° | ambos «índice a circular sobre a palma que não existe» |
| `trabalhar` ≡ `sapato` | 0,00° | ambos «dois punhos a bater» |
| `olho` ≡ `nariz` | 0,00° | o `local` de ambos é `olho` |
| `casa` ≈ `sempre` | 0,77° | ambos «duas mãos planas à frente» |
| `ajudar` ≈ `futebol` | 1,09° | ambos «punho junto à palma vazia» |
| `ler` ≈ `caneta` | 0,45° | ambos «índice sobre a palma vazia» |

Agrupando por transitividade, o grafo de gémeas tem 11 componentes que cobrem **187 das
191 palavras** — mas o maior componente encadeia 80 palavras por transitividade (A≈B,
B≈C…), o que exagera a semelhança real. O número honesto a citar é o de pares: **2059
pares abaixo de 8°**. As famílias que partilham a mesma notação base, contadas do
léxico:

| família | n | palavras |
|---|---|---|
| `2:plano frente *` — duas mãos planas à frente, palmas à câmara | **15** | bom dia · professor · caderno · livro · carteira · grande · lento · casa · mesa · quarto · agora · mercado · música · sempre · devagar |
| `plano peito *` — mão plana no peito, palma ao corpo | **9** | bom · mau · por favor · cinza · dar · feliz · chamo-me · filho · filha |
| `aponta <cara> *` — índice vertical junto à cara | **11** | responder · vermelho · preto · rosa · doente · não entendo · até amanhã · olho · boca · nariz · dever |
| `aponta mao *` — índice sobre uma palma que não está lá | **11** | caneta · lápis · escrever · ler · feijão · velho · semana · mês · hora · dedo · pagar |
| `* punho frente *` — punhos a bater à frente | **7** | correr · trabalhar · fazer · leite · muito bem · ano · sapato |

## O que está certo

Dois testes diferentes, e um sinal pode passar num e falhar no outro. **Gesto legível**
= um leitor de IS reconheceria o gesto. **Distinto** = nenhuma outra palavra produz a
mesma animação.

Gestos que **se lêem** no avatar, julgados contra o vídeo e contra a fotografia:
`azul` (B à frente a subir), `amarelo` (Y ao ombro), `trabalhar` (dois punhos a bater),
`como te chamas` (dois H a tocar-se), `frio` (dois punhos a tremer ao peito),
`amanhã`/`ontem` (polegar para cima, para a frente / para trás), `muito` (braços abertos
a subir), `teto` (mãos a encontrar-se no topo da cabeça), `dia` (mão plana em arco a
subir), `cansado`, `roupa`, `cartão`, `brincar`, `dormir`, `acordar`,
`mãe`/`pai` (mão aberta ao queixo vs à testa), `correr`, `comer`, `fruta`, `sede`,
`preto`, `vermelho`, `orelha`, `braço`, `dente`, `lição`, `família`, `agosto`,
`precisar`, `poder`.

Mas quase todos ainda falham o segundo teste: `trabalhar` lê-se e é igual a `sapato`;
`preto` lê-se e é igual a `vermelho` dentro da família do índice na cara; `teto` lê-se e
é igual a `igreja`. **Menos de 10 palavras passam os dois testes.**

## Duas hipóteses anteriores, agora refutadas

Medir em vez de olhar a salvo de duas asneiras:

1. **«a mão encrava no torso»** — falso. Nenhum dos 191 sinais leva o punho ou a ponta
   do dedo médio a menos de 26 cm do esterno. A aparência de encravamento nas
   fotografias era sobreposição *visual* no recorte 2D, não colisão 3D.
2. **«o IK não chega aos alvos baixos»** — quase falso. O IK acerta o alvo a 0,000 m em
   14 dos 15 locais. Só `baixo` fica fora de alcance, e só por 13,6 cm, em 3 sinais
   (`pé`, `hoje`, `aqui`).

## O que isto quer dizer

**Editar strings não chega.** 30% do léxico colide por string repetida, mas mesmo as 160
strings distintas produzem só ~25 sinais legíveis, porque o renderizador não consegue
expressar: orientação da palma por sinal, mão-parceira como superfície, movimento
visível, e mãos assimétricas em contacto. Para chegar a «picture perfect, every single
one» tem de se alargar o modelo de capacidades — é uma alteração arquitectónica e precisa
de aprovação antes de tocar em código.
