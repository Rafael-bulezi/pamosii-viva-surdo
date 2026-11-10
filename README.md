# Viva Surdo — texto em, sinais out

Protótipo da **Viva Surdo** para ver uma frase em Língua Gestual Angolana (LGA) e
procurar palavras num dicionário de sinais. Duas funções, duas páginas:

A marca oficial está em `app/assets/logo-viva-surdo.png`; a interface usa o emblema
(`logo-emblem.png`) e o disco com a orelha (`logo-mark.png`). A primeira sinalizadora
3D chama-se **Agatha** — nome provisório, guardado em `dados.js` (`SINALIZADOR`),
nunca escrito no texto dos botões.

| Rota | Função |
| --- | --- |
| `#/` | Três modos: caixa de texto (escrever ou carregar ficheiro), **traduzir ao vivo** pelo microfone, ou o dicionário |
| `#/dicionario` | Procurar uma palavra por tema e ver a forma da mão (aba International Sign) |
| `#/dicionario?fonte=lga` | Inventário de estudo da LGA: 246 palavras das aulas em vídeo do Viva surdo, com minuto, confiança e link |

Não é tradução automática. A glosa é uma **sequência de estudo**: artigos e
preposições caem, o tempo vai à frente, o «não» vai ao fim. A ordem, o espaço de
sinalização e a expressão facial de um sinalizador surdo não cabem numa lista de
palavras — por isso o site diz, em dois sítios, que as associações estão **por
validar** por sinalizadores surdos.

## Correr

Sem build, sem dependências, sem backend. Servir `app/` como ficheiros estáticos:

```bash
node tools/serve.cjs          # http://127.0.0.1:8123
```

Em `localhost` o service worker fica desligado de propósito (escondia ficheiros
acabados de editar). Para o testar: `http://127.0.0.1:8123/?sw=1`.

```
app/
  index.html            página única, carrega referências → dados → LGA → mãos → 3D → app
  styles.css            tokens, temas claro/escuro/alto contraste, telemóvel
  referencias.js        GERADO: o que o léxico International Sign documenta
  dados.js              glossário (19 temas, 298 palavras) + glosador
  lga.js                GERADO: 246 palavras das aulas de LGA do Viva surdo
  lga-3d.js             poses 3D das palavras da LGA já lidas no quadro (19)
  maos.js               rig das mãos em SVG + notação dos sinais (191 sinais)
  avatar.js             sinalizadora 3D (three.js + GLB), câmara, poses
  sinal3d.js            notação → poses de ossos (âncoras em metros na malha)
  app.js                duas vistas, caixa de texto (SRT/VTT/PDF), acessibilidade
  aoVivo.js             reconhecimento de fala (pt-PT) do modo ao vivo
  api/sinais.js         função da Vercel: frase → sinais do léxico (OpenRouter)
  api/sinais-lista.json GERADO: os 179 sinais que a app sabe desenhar, por tema
  sw.js                 casulo offline (VERSAO = ?v= do index)
  manifest.webmanifest  instalação e atalhos
  assets/               marca, ícones e agatha-mpfb-rig.glb (o modelo)
  vendor/               three.js e GLTFLoader servidos de casa, sem CDN
```

## Como o sinal é desenhado

Cada sinal é uma notação de três palavras — **forma · lugar · movimento** — e o
prefixo `2:` marca dois mãos:

```
'água': 'curva boca baixo'      'casa': '2:curva telhado baixo'
```

As 32 formas de mão (`A`–`Z` e `abre`, `plano`, `punho`, `aponta`, `curva`,
`relax`, `garra`) são **ângulos de articulação**, não desenhos. Entre dois sinais o rig
interpola os ângulos (`formaMisturar`), por isso a mão **dobra-se** em vez de
trocar de imagem.

No palco principal a mesma notação move uma **sinalizadora em 3D**: um modelo
rigged (`assets/agatha-mpfb-rig.glb`, 55 ossos com nomes VRM, gerado de
`tools/fonte/agatha-mpfb.glb` por `tools/melhorar-rig.py`) animado por
`avatar.js`. Cada lugar da notação é um alvo em metros para o pulso — testa,
boca, queixo, esterno, ombro, telhado — medido na própria malha, não nos pivôs
dos ossos; `sinal3d.js` resolve-o por IK de dois ossos e aplica a forma da mão
aos dedos. O dicionário continua a mostrar a forma desenhada (`maoFigura`) e,
se o GLB não carregar ou não houver WebGL, o palco cai para as mãos SVG
(`maoCena`) sem perder a sequência. Tempo: 760 ms por sinal, 340 ms por letra
soletrada. O palco em si (fundo, luzes, sombras, materiais e recolor da roupa)
está descrito na secção 2.2 de `tools/fonte/qc-personagem-2026-11-03.md`; a
lista de modelos alternativos, com preços e prova de ossos de dedos, está em
`tools/fonte/avatares-candidatos-2026-11-04.md`.

## Entradas

A página inicial tem três cartões e nada por baixo deles: o texto abre numa
**caixa** sobre a própria página (duas abas: escrever, carregar ficheiro), o
microfone liga o modo ao vivo, e o terceiro cartão é o dicionário.

- **Texto** escrito na caixa; `Ctrl + Enter` sinaliza.
- **Ficheiro** `.txt`, **legendas** `.srt` / `.vtt` (só o texto das falas) ou
  **PDF** com camada de texto, lido no próprio browser
  (`DecompressionStream`, sem bibliotecas). PDF digitalizado não tem texto — a
  caixa di-lo em vez de inventar.
- **Ao vivo** — o Chrome transcreve a fala (`webkitSpeechRecognition`, pt-PT) e
  cada frase fechada segue para `POST api/sinais`; um modelo escolhe até oito
  palavras **do léxico que a app sabe desenhar** e o painel enfileira os sinais.
  Sem chave configurada, sem rede ou se o modelo falhar, o motor de regras
  glosa a mesma frase e o painel mostra a pastilha `modo simples`.

No modo de texto e de ficheiro nada sai do aparelho. No modo ao vivo a frase (e
só a frase — nunca o áudio) vai para `api/sinais` e daí para o modelo; o painel
di-lo numa linha no rodapé e o «i» repete-o. O único `localStorage` continua a
ser `vs.a11y`. A chave do modelo vive **só** em `OPENROUTER_API_KEY`, no
servidor: não há chave no repositório nem no browser.

## Testes

```bash
node tools/integridade-test.cjs   # claims, privacidade, versão do casulo, notação, acessibilidade
node tools/engine-test.cjs        # glosa de 7 frases + lemas e plurais
node tools/sinais-test.cjs        # contrato de api/sinais: estados, filtro, limite por IP, retrato
node tools/gerar-sinais-llm.cjs   # reescreve app/api/sinais-lista.json a partir do léxico
```

O teste de integridade avalia `dados.js` + `maos.js` num `vm` e falha se um
sinal tiver forma, lugar ou movimento que o rig não conhece, se os três
ficheiros declararem a mesma `const` (o segundo deixaria de correr) ou se o
`?v=` do index não bater com o `VERSAO` do service worker.

### Auditoria do que o avatar realmente faz

Os testes acima validam a *notação*. Nada neles mede o *render*. Para isso:

```bash
node tools/serve.cjs                              # noutro terminal
node tools/folha-3d.cjs --todos --porFolha=6      # 32 folhas com início+fim de cada sinal
node tools/folha-3d.cjs --alfabeto --maos         # as 26 letras em close-up
node tools/sonda-alcance.cjs                      # 55 ossos × 2 instantes × 191 palavras
node tools/analisa-alcance.cjs                    # erro de colocação, amplitude, gémeas
node tools/colisoes.cjs                           # palavras com notação idêntica
node tools/auditoria-render.cjs > tools/fonte/auditoria-render.json
```

Veredicto e números em `tools/fonte/auditoria-render-2026-11-01.md`. O resultado
principal: **187 das 191 palavras têm pelo menos outra palavra cuja animação é
indistinguível** (＜8° de diferença média por osso), e o gargalo é o modelo de
capacidades do renderizador — orientação da palma presa ao `local`, mão-parceira
inexistente, movimento escalado por `ESC_MOV`, e mãos duplas sempre espelhadas —
não as strings.

Antes de escrever à mão, verificou-se se existia animação aberta para retarget:
`tools/fonte/pesquisa-animacao-2026-11-01.md` (e `mocap-estilo-2026-11-01.json`).
Conclusão: **não há dados de LGA**; o corpus CC0 existente é ASL e serve de
referência de estilo, não de conteúdo. Números medidos: o punho real percorre
120–300 cm por sinal e a palma roda 360–714°, contra 5,7 cm e 0° no nosso avatar.

Os restantes scripts em `tools/` (`ingerir-*`, `sonda-*`, `auditoria-visual`,
`fetch-biblia`, `parse-yt`, `yt-search`) são do site maior que este branch
substituiu — não são usados por esta app.

## Regras de honestidade

A interface não pode afirmar o que o código não faz:

- não é tradução automática nem tradutor português ↔ LGA;
- não reconhece sinais por câmara; no modo ao vivo ouve voz, mas só para
  escolher palavras do léxico, nunca para ler gestos;
- nenhum sinal está «validado pela comunidade surda»;
- não se usa «pessoas normais»;
- não se inventam preços, depoimentos, mentores ou contagens;
- o texto da Open Minds Academy não se reutiliza.

Estas regras vivem em `tools/integridade-test.cjs`; se alguém escrever a
promessa no site, o teste falha.

## De onde vêm as referências (International Sign)

O dicionário separa três coisas que antes se misturavam numa palavra só:

- **referência** — a palavra tem sinal documentado no léxico International Sign
  da Sématos (439 entradas, colhidas dos sitemaps públicos a 2026-10-31 para
  `tools/fonte/sematos-isl-slugs.txt`). O cartão liga ao vídeo da fonte: nos
  cartões que só têm referência é o cartão inteiro; nos que também têm pose 3D
  é o selo ▶ no canto superior direito da figura.
- **pose 3D** — a nossa notação `forma · lugar · movimento`. Nem toda a
  referência tem pose e nem toda a pose tem referência; o site diz os dois
  números separados, à partida.
- **comparado** — alguém viu fotogramas do vídeo da fonte e escreveu o veredicto
  (`igual`, `corrigido` ou `aproximado`) em `tools/fonte/is-comparado.json`.
  À data de 2026-11-01 as 83 palavras que têm referência **e** pose foram todas
  vistas: 50 notas corrigidas, 22 já batiam certo e 11 ficaram `aproximado`
  porque a notação de três palavras não consegue dizer o que o vídeo mostra
  (palma por sinal, ou as duas mãos com formas diferentes).

A pipeline, pela ordem:

```
python tools/mapear-is.py --escrever    # português -> slug IS; o mapa vive aqui
python tools/gerar-referencias.py       # escreve app/referencias.js
python tools/comparar-is.py "bom dia"   # folhas de fotogramas em ~/glb-lab/shots
python tools/comparar-is.py --lote <folha> --zoom1 "casa" "café"  # várias
                                       # palavras numa folha, a altura toda
```

`tools/integridade-test.cjs` não deixa as três camadas voltarem a separar-se: só
há «visto no vídeo» se a palavra estiver no caderno com uma descrição do que se
vê, e o `depois` do caderno tem de bater com o que `maos.js` desenha hoje — mudar
um sinal sem voltar a compará-lo chumba o teste.

O que a fonte não documenta fica sem referência, e o cartão diz isso: é o caso de
«olá», «obrigado», «por favor» e dos catorze termos do tema Corpo, entre outros
96. Não se inventa parentesco para encher o quadro.

## Publicação

Link para partilhar: <https://vivasurdo.vercel.app> (projeto `vivasurdo`, conta
`rafael-bulezi`). Publicado com o CLI, a partir da raiz do repositório:

```
vercel deploy --prod --yes --cwd app
```

O `vercel link --yes --project vivasurdo --cwd app` que cria o projeto tenta
ligar o repositório GitHub e falha (`400`, a conta de publicação só tem leitura
no repositório de origem). A falha é inofensiva: o projeto fica criado e `app/.vercel/`
fica ligado a ele. **Depois do link, apagar `app/.env.local`** — o CLI escreve lá
um `VERCEL_OIDC_TOKEN` e, se o ficheiro ainda estiver lá, sobe como ficheiro
estático público do site. `app/.gitignore` já ignora `.vercel` e `.env*`.

Publicado também em <https://rafael-bulezi.github.io/pamosii-viva-surdo/> (fork).
A 2026-11-03 o Pages foi alinhado com o local em **vs116** (commit `b614f92` da
branch `gh-pages`): sobre a revisão do renderizador (`d2af632`), a correcção
`varre` (`305f6ed`) e o selo ▶ (`010a225`), corrige `nunca` — vídeo Sématos
`never-3897`, mão plana com a palma para baixo a descer da cara ao peito, em vez
da varredura lateral com a palma para a frente (`a90a738`). Em **vs117**
(`4165512`) o palco muda de aspecto: fundo de estúdio escuro teal, ambiente IBL
gerado por PMREM com cinco painéis, luz-chave com sombra própria
(`PCFSoftShadowMap`), rig de seis luzes retocado e materiais físicos por peça
(pele com clearcoat discreto, cabelo e fato com sheen, olhos com clearcoat duro).
A roupa é recolorida em tempo de execução por banda de matiz — o verde passa a
teal e a ganga azul a carvão, mantendo costuras e vincos da textura — e o busto
fica mais apertado (folga 1.10 em vez de 1.18). O Pages foi republicado em vs117
(commit `b18192e` da branch `gh-pages`) e o Vercel em
<https://vivasurdo.vercel.app> serve a mesma versão. Em **vs118** o dicionário
ganha duas abas de fonte: *International Sign* (a lista de sempre) e *LGA · Viva
surdo*, gerada a partir de `tools/fonte/aulas-lga/*.json` por
`python tools/gerar-lga.py` para `app/lga.js` — 246 palavras de 12 aulas em
vídeo, cada cartão com aula, segundo, confiança e descrição, e um link direto
para o momento da aula no YouTube. 80 destas palavras já existem no glossário;
as restantes são inventário de estudo. As entradas de confiança baixa (12, do
Diálogo 01) estão marcadas para revisão humana. Em **vs119** a marca passa a ser
a oficial: o disco com a orelha no cabeçalho e no botão flutuante, o emblema no
rodapé, ícones novos, tema em azul-real `#1C4F9C` (também no estúdio do palco) e
o nome da sinalizadora em `dados.js`, fora do texto dos botões. Em **vs120** o
favorito passa a ser `app/favicon.ico` (disco com a orelha em 16/32/48/64 px),
referenciado com `?v=` para o browser não reutilizar o ícone antigo que tinha em
cache. Em **vs122** a camada 3D da LGA chega à página: `lga-3d.js` traz a pose já
lida no quadro para 18 palavras (7 marcadas `≈` porque são aproximação
declarada), os cartões da aba LGA mostram a mão da pose com um selo `3D`/`3D ≈`
e abrem a Agatha no palco em vez de saltarem para o YouTube (o ▶ ao lado
continua a abrir a aula no segundo certo; o selo fica à esquerda para não ficar
debaixo do ▶); as restantes palavras continuam a abrir o vídeo. O favorito ganha um **círculo branco** por trás do disco (a marca
azul-real desaparecia na barra de separadores escura), regerado a 16/32/48/64 px.
Em **vs123** o dicionário abre numa **porta com duas fontes** — um cartão azul
para a LGA, um branco para o International Sign, cada um com as contagens reais
— e só depois entra na lista da língua escolhida (`#/dicionario?fonte=lga` ou
`?fonte=is`); as migalhas «← Fontes» e o atalho para a outra língua ficam sempre
no topo. Os cartões foram refeitos: a mão da pose passa a desenhar-se sem fundo
sobre um painel com gradiente, os cartões sem pose passam a miniatura de vídeo
(▶ ao centro, aula e segundo na faixa de baixo, em vez de uma caixa vazia), a
confiança passa a `confiança alta/média/baixa` com o ponto colorido, e o selo
`3D` fica à esquerda para o ▶ não o tapar. Em **vs124** as duas saudações da
Aula 01 são refeitas contra os quadros: `oi/olá` desce do alto da cabeça para ao
lado da cara (local novo `rosto`, punho a 1,43 m) e o aceno passa a ser um
movimento próprio (`aceno`): a mão desloca-se ~15 cm de lado, com o antebraço a
acompanhar, em vez de rodar só o pulso; vai e volta duas vezes, a 1,7 s.
`bom dia` é composto e passa a tocar em dois compassos — polegar erguido ao
peito e depois mão plana que sobe do queixo ao lado da cara —, por isso
`notacao` na camada 3D aceita agora uma lista de passos (o cartão mostra o
primeiro e o painel toca ambos, com um só chip). Em **vs125** `tchau/adeus` deixa
de ser um aceno no alto com o pulso a rodar e passa a ser o **mesmo sinal** de
`oi/olá` — mesma forma, mesmo lugar à altura da cara, mesmo movimento, mesma
duração; a aula usa o mesmo aceno para chegar e para sair. Em **vs126** os
cartões deixam de ser caixas brancas com três linhas: cada modo passa a ser um
pequeno cartaz com campo de cor (azul-real, ciano, amarelo), uma ilustração
desenhada a `currentColor` — o editor com a mão, o fotograma com legendas e
tempo, duas fichas de dicionário com a lupa —, o número do modo em marca de
água, a etiqueta do gesto e a acção escrita por baixo; nos cartões de fonte do
dicionário o International Sign ganha globo, play e mão (era uma caixa vazia) e
as pastilhas dizem `202 sinais IS · 439 no léxico · 83 comparados`. Os três
temas servem-se das mesmas variáveis (`--card-*`), com pastilhas de acção
cheias no escuro e preto sobre acento no contraste alto. A auditoria de
controlos obrigou a mais: `Ficheiro` e `Abrir vídeo` passam a `<button>` (eram
`<label>`, sem foco por teclado); os transportes ficam desligados sem glosa e
`‹`/`›` desligam nos extremos; a fita vazia explica-se («a glosa aparece aqui»);
o cartão `Texto` acende o painel do editor em vez de só lhe dar foco; `Ver
sinais` com palavras sem sinal diz que nenhuma tem sinal (antes pedia para
escrever algo com texto já escrito); a bolha flutuante usa o texto do editor; e
carregar no separador onde já estamos volta ao topo e limpa os filtros do
dicionário. `docs/AUDITORIA-BOTOES.md` guarda a tabela controlo a controlo.

Em **vs127** o painel da sinalizadora passa a ocupar **80% da altura do ecrã**
(560 px de largura), e o palco cresce com ele: o mesmo enquadramento mostra a
figura cerca de 40% mais alta do que na janela de 340 px, e a folga da câmara
desce de 1,16 para 1,06 para o rosto e as mãos lerem melhor sem cortar os
braços. O canto superior ganha um botão de **ecrã inteiro**; onde a API não
existe (Safari iOS) a mesma acção usa a classe `.cheio`, que ocupa o viewport, e
`Esc` fecha o painel quando não há fullscreen nativo. A nota de estudo ganha um
**«i»**: ao passar o rato, focar ou tocar abre a explicação de que são gestos de
estudo e não tradução de LGA. No escuro, o `Repetir` ligado deixa de ficar
azul-escuro sobre azul-escuro. O objectivo seguinte — a sinalizadora acompanhar
uma pessoa a falar em tempo real (fala → glosa → sinal) — **ainda não está
implementado**: o painel toca uma glosa preparada.

Em **vs130** a página inicial passa a ter **três cartões e nada por baixo**: o
editor, a fita, o leitor de vídeo e o botão flutuante saem (o `#/` deixa de ter
um leitor de legendas com vídeo). `Texto` abre uma **caixa** por cima da página,
com duas abas — escrever (contador de palavras, exemplo, `Ctrl + Enter`) e
carregar ficheiro (`.txt`, `.srt`, `.vtt`, `.pdf`) —, e `Traduzir ao vivo` é o
novo segundo cartão. O painel da sinalizadora encolhe de 560 para **430 px** e
o palco azul passa a levar **89% da altura do painel** (673 de 756 px num ecrã
1440×900; 745 de 828 px em 390×844, medido em Chrome headless com o avatar
carregado): a nota legal muda-se para o «i» do topo, a frase fica numa linha e
a glosa e o transporte assentam sobre um véu no fundo do próprio palco. O modo
**ao vivo** deixa de ser promessa: `app/aoVivo.js` reconhece fala em pt-PT
(volta a arrancar quando o Chrome fecha o reconhecedor por silêncio), cada frase
fechada faz `POST api/sinais`, e a função da Vercel (`app/api/sinais.js`) pede
ao modelo até oito palavras **da lista de 179 que a app sabe desenhar** — a
mesma lista vai no prompt e filtra a resposta, por isso uma resposta inventada
não produz um sinal inexistente. Sem `OPENROUTER_API_KEY`, sem rede ou com o
modelo em baixo responde 503/502 e o cliente glosa com o motor de regras,
mostrando `modo simples`. O `sinais.js` guarda os 20 pedidos por minuto e IP,
limita a frase a 300 caracteres, usa `temperature: 0` e nunca deixa a chave
sair no corpo do pedido (`tools/sinais-test.cjs`, 35 verificações).

Em **vs131** o microfone deixa marca no ecrã: enquanto `AO_VIVO.ligado()` for
verdade, a moldura do site ganha um anel de 4 px com um gradiente cónico que
gira (18 s por volta, em `steps(90)` — o anel repinta 5×/s, não 60×/s), um halo
parado colado às bordas (gradiente de 26 px de desfoque, rasterizado uma vez) e
uma névoa que sobe 40vh da base, mais alta ao centro do que nos cantos; a névoa
só anima opacidade e deslocamento, que fica no compositor, e nada disto é
canvas, rAF ou DOM novo. Tudo pára quando o separador fica escondido, quando o
painel fecha, quando a sinalização não é ao vivo ou com `prefers-reduced-motion`
(aí o global `.001ms` faria o anel girar mil vezes por segundo, por isso o anel
e a névoa ficam com `animation: none`); em alto contraste e `forced-colors` o
brilho desaparece e o anel passa a branco ou `Highlight`. O `Repetir` passa a
recomeçar a sequência quando a cabeça já está no fim (antes o clique só mudava a
bandeira e nada mexia no palco). Os três cartões da página inicial ganham
superfícies em gradiente — azul→branco, azul-escuro→branco e turquesa→branco —,
perdem a numeração e a pastilha do canto, e o desenho do dicionário passa a
mostrar a lista do léxico à esquerda, a mão em destaque e a marca de ▶ do vídeo
(substituído em vs132).

Em **vs132** a arte dos cartões deixa de ter mãos. Os desenhos eram feitos de
rectângulos com dedos e liam-se como luvas, por isso cada cartão passa a mostrar
um **objecto**: a janela de texto com um selo «Aa» no cartão Texto, o microfone
com as ondas e o painel de legendas no Traduzir ao vivo, um **livro aberto** com
marcador e lupa no Dicionário, uma **bandeira angolana** com a estrela emblema no
cartão LGA do dicionário e um globo com ▶ no International Sign. Tudo a
`currentColor` e opacidades — a mesma arte serve o tema claro, o escuro e o
contraste alto. A moldura do modo ao vivo perde a lavagem de cor que subia pelos
lados e passava por cima do conteúdo: fica um anel de **3 px** só nos azuis e no
turquesa da marca, um halo interior de 26 px de desfoque e uma névoa de **34vh**
colada à base, mais alta ao centro (o «brilho mais alto em baixo» do Gemini
Live). O movimento não muda de custo: o anel gira em `steps(90)`, 5 repinturas
por segundo, e a névoa só anima opacidade e deslocamento.

Em **vs133** o brilho ganha a textura do exemplo «Gemini Live — Honeycomb &
Pixel Edge Glow», mais discreta: uma faixa de **42 px** (26 px no telemóvel)
colada à moldura, com favos de **12 px** contra os 28 px do exemplo. Cada célula
tem só o contorno aceso e o interior quase transparente, e os intervalos entre
células ficam escuros — por isso os favos leem-se um a um em vez de uma mancha
contínua. O padrão desliza dois favos na diagonal em 12 s com `steps(24)` (duas
repinturas por segundo) e um clarão cónico percorre a moldura em `steps(90)`: só
as células por onde ele passa acendem, o resto fica no azul da cauda. O brilho
geral desce (halo e anel mais fracos, névoa de 28vh), o `.vivo-favos` fica no
`z-index: 78` — abaixo do painel da sinalizadora (79) — e em alto contraste,
`forced-colors` ou movimento reduzido a faixa desaparece.

Em **vs128–vs129** a espera do modelo deixa de ser muda: o GLTFLoader recebe um
`progresso` e os palcos escrevem `A preparar a sinalizadora… 37%`. O ficheiro
tem 13,8 MB e numa ligação lenta desce a 47–57 KB/s (243 s vindo do Pages, 294 s
do Vercel), por isso «A preparar…» sem número lia-se como avaria. O Pages manda
`Content-Length` e mostra a percentagem; o Vercel serve o GLB com Brotli e **sem**
`Content-Length`, aí o total é 0 e a espera conta `… 2,4 MB` em vez de inventar
uma percentagem. A escrita só acontece nos palcos que ainda dizem «A preparar…»,
para não sobrepor «O modelo 3D não carregou» nem «Sem sinais para esta frase».

O repositório de origem <https://7dark7cloud7.github.io/pamosii-viva-surdo/>
continua na versão anterior (18 rotas): a conta de publicação só tem leitura no
repositório original, por isso as versões novas saem pelo fork. O slug com dois
erres (`pamosii-viva-surado`) devolve 404; o slug vivo é `pamosii-viva-surdo`.

Para publicar no Pages: copiar `app/` para a branch `gh-pages` **sem apagar o
`.nojekyll`** que só existe nessa branch (um `rsync --delete` da pasta `app/`
remove-o e o Jekyll volta a tentar processar os ficheiros), mudar `const VERSAO`
em `app/sw.js` **e** todos os `?v=` em `app/index.html` para o mesmo valor
(o local está em vs133: 14 ocorrências em `index.html`, incluindo ícone e
folhas de estilo), correr
`node tools/integridade-test.cjs`, `node tools/engine-test.cjs` e
`node tools/sinais-test.cjs` e enviar a `gh-pages`. A Pages do fork pode
precisar de um build manual (`POST /repos/Rafael-bulezi/pamosii-viva-surdo/pages/builds`).

O Pages só serve ficheiros estáticos: o modo ao vivo funciona lá a cair sempre
no motor de regras. A função vive no Vercel, que tem a raiz do projecto em
`app/` (por isso `app/api/sinais.js`); publica-se com
`npx --yes vercel deploy --prod --yes` a partir de `app/`. A chave
`OPENROUTER_API_KEY` é variável de ambiente do projecto Vercel — sem ela a
função responde 503 e a app diz `modo simples`.

O service worker guarda a página e os scripts, mas **não** guarda o GLB de
13 MB. Uma escrita de cache falhada nunca pode substituir uma resposta boa da
rede — o `put` fica num try próprio e a resposta segue.

## Limites conhecidos

- A notação não tem uso do espaço próprio do sinal; a orientação da palma
  existe por sinal em `AJUSTES` (hoje só `nunca`) e por lugar (`telhado`); é um
  treino de estrutura, não um vídeo de referência. A expressão facial do modelo 3D vem do tipo de
  palavra — pergunta, negação, saudação — e não do sinal; o rig SVG não tem
  rosto.
- O modelo 3D tem 13 MB e fica fora do casulo offline: num telemóvel em 3G o
  palco pode demorar; até lá mostra «A preparar a sinalizadora…» e, se falhar,
  cai para as mãos SVG.
- A ordem das palavras segue seis regras simples de glosa; não é a gramática
  da LGA.
- As referências IS são palavra a palavra (léxico Sématos). Não existe um
  conjunto de frases IS com fonte livre usado aqui, por isso o glossário
  apresenta sinais isolados e não frases assinadas: montar frases exigiria
  gramática IS validada, e não gestos inventados.
- A soletração usa uma forma por letra e não distingue variantes regionais.
- A aba LGA é um **inventário de estudo** das aulas do Viva surdo, não um
  dicionário validado: cada cartão diz a aula, o segundo e a confiança da
  leitura (alta/média/baixa); as 12 entradas de confiança baixa vêm do Diálogo
  01, cuja sinalização aparece numa janela pequena que as folhas de contacto
  não mostram — ficam para revisão humana. As descrições são leituras nossas
  dos fotogramas e não substituem a validação por sinalizadores surdos; o mesmo
  vale para as 18 poses da Agatha, e as 7 com selo `3D ≈` dizem-se aproximação
  na própria página.

## Visão & Próximos Passos — Homepage Cinematográfica (2 Personagens)

Ideia arquitetural e visual para as próximas iterações:
- **Homepage cinematográfica com 2 personagens**: Transformar o palco inicial da aplicação num ambiente imersivo onde dois personagens 3D interagem e dialogam em tempo real (inspirado nas aulas de diálogo da LGA, com troca fluida de turnos e enquadramento de câmara cinematográfico).
- Detalhes e especificações a aprofundar pelo Rafael nas próximas fases.

