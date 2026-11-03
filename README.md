# Agatha — texto em, sinais out

Protótipo da **Viva Surdo** para ver uma frase em Língua Gestual Angolana (LGA) e
procurar palavras num dicionário de sinais. Duas funções, duas páginas:

| Rota | Função |
| --- | --- |
| `#/` | Colar texto, legendas (`.srt`/`.vtt`) ou um PDF e ver a glosa em sinais animados |
| `#/dicionario` | Procurar uma palavra por tema e ver a forma da mão |

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
  index.html            página única, carrega referências → dados → mãos → 3D → app
  styles.css            tokens, temas claro/escuro/alto contraste, telemóvel
  referencias.js        GERADO: o que o léxico International Sign documenta
  dados.js              glossário (19 temas, 298 palavras) + glosador
  maos.js               rig das mãos em SVG + notação dos sinais (191 sinais)
  avatar.js             sinalizadora 3D (three.js + GLB), câmara, poses
  sinal3d.js            notação → poses de ossos (âncoras em metros na malha)
  app.js                duas vistas, leitor (SRT/VTT), PDF local, acessibilidade
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
soletrada.

## Entradas

- **Texto** colado.
- **Ficheiro** `.txt`.
- **Legendas** `.srt` / `.vtt`; com um vídeo aberto, os sinais seguem o tempo
  das falas.
- **PDF** com camada de texto, lido no próprio browser
  (`DecompressionStream`, sem bibliotecas). PDF digitalizado não tem texto — a
  página di-lo em vez de inventar.

O texto colado, os ficheiros e o vídeo ficam no aparelho: não há microfone,
`sendBeacon` nem POST, e o único `localStorage` é `vs.a11y` (opções de
acessibilidade). A rede só serve os ficheiros estáticos do próprio site,
incluindo o modelo 3D.

## Testes

```bash
node tools/integridade-test.cjs   # claims, privacidade, versão do casulo, notação, acessibilidade
node tools/engine-test.cjs        # glosa de 7 frases + lemas e plurais
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
- não reconhece sinais por câmara, nem voz, nem microfone;
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
A 2026-11-03 o Pages foi alinhado com o local em **vs115** (commit `79c09e9` da
branch `gh-pages`): inclui a revisão do renderizador (`d2af632`), a correcção
`varre` (`305f6ed`) e o selo ▶ dos sinais com vídeo de origem (`010a225`). O
repositório de origem <https://7dark7cloud7.github.io/pamosii-viva-surdo/>
continua na versão anterior (18 rotas): a conta de publicação só tem leitura no
repositório original, por isso as versões novas saem pelo fork. O slug com dois
erres (`pamosii-viva-surado`) devolve 404; o slug vivo é `pamosii-viva-surdo`.

Para publicar no Pages: copiar `app/` para a branch `gh-pages` **sem apagar o
`.nojekyll`** que só existe nessa branch (um `rsync --delete` da pasta `app/`
remove-o e o Jekyll volta a tentar processar os ficheiros), mudar `const VERSAO`
em `app/sw.js` **e** todos os `?v=` em `app/index.html` para o mesmo valor (o
local já está em vs115: 9 ocorrências em `index.html`), correr
`node tools/integridade-test.cjs` e `node tools/engine-test.cjs` e enviar a
`gh-pages`. A Pages do fork pode precisar de um build manual
(`POST /repos/Rafael-bulezi/pamosii-viva-surdo/pages/builds`).

O service worker guarda a página e os scripts, mas **não** guarda o GLB de
13 MB. Uma escrita de cache falhada nunca pode substituir uma resposta boa da
rede — o `put` fica num try próprio e a resposta segue.

## Limites conhecidos

- A notação não tem uso do espaço nem orientação de palma por sinal (só o
  lugar `telhado` tem uma inclinação própria); é um treino de estrutura, não
  um vídeo de referência. A expressão facial do modelo 3D vem do tipo de
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
