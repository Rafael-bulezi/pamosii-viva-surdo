# Referência — página «ring» (OFFLINE, @filatov.design)

Fonte: https://www.threads.com/@filatov.design/post/DfhSPcxgPLX (caption: «I built an
interactive website for a streetwear brand. nine models stand on a ring: drag it, flip it
into a grid, open a look, and a paper receipt prints down from the top.»)

Ficheiros locais (não estão no repositório, são de terceiros):

- vídeo: `C:/Users/rafae/AppData/Local/Temp/vs-threads/ref/streetwear-ring.mp4` (21,75 s, 1144×718, 30 fps)
- fotogramas: mesma pasta, `f-0.2.png`, `f-2.4.png`, `f-5.5.png`, `f-13.0.png`, `f-19.0.png`
- folha de contacto 1 fps: mesma pasta, `sheet-1s.png`

## Paleta medida (amostrada dos fotogramas)

| uso | valor |
|---|---|
| tela (fundo da página) | `#EBE8EC` |
| chão atrás dos modelos | desvanece para `#FFFFFF` |
| tinta | `#0B080C` |
| papel do recibo | `#FDFDFD` |
| botão circular / barra CTA | preto cheio, sem sombra |
| cor | só a que vem do próprio 3D; a interface é acromática |

## Grelha e tipografia

- Tudo cabe num único ecrã; nada rola.
- Barra superior tipo sistema operativo, 44 px: hora + `NO SERVICE` em mono 8 px à esquerda;
  marca centrada (`OFFLINE®`, versaletes com tracking largo); à direita bateria `12%` e uma
  pílula de contorno `BAG (0)`. QR de 34 px no canto superior esquerdo.
- Rótulos funcionais: mono, versaletes, 8–9 px, tracking `.08em`, cinza-escuro.
- Título grande em baixo à esquerda: grotesca condensada, versaletes, 36–40 px, tracking
  apertado (`DO NOT DISTURB`, `SIDE A`, `06. STATIC`).
- Réguas de 1 px; pílulas com raio total e contorno de 1 px; nada de sombras difusas na interface.

## Ecrã 1 — ring (herói)

- Nove figuras 3D de pé num anel oval, todas à mesma escala, de frente para a câmara.
- A da frente está nítida e grande (ocupa ~60% da altura); as de trás desfocam por
  profundidade de campo, sem caixa de cartão à volta.
- Anel arrastável: um badge circular cinzento com a palavra `DRAG` segue o cursor.
  Ao rodar, a figura seguinte assume o centro e a legenda/título muda (`07 / 09`, `SIDE A`).
- Canto inferior esquerdo: `01 / 09` + ícone ▶; por baixo o título grande.
- Canto inferior direito: `SHOP THE LOOK` em mono + botão circular preto de 46 px com `+`.
- Centro inferior: três pílulas de produto (miniatura redonda ~28 px, nome em mono 9 px,
  preço em mono 9 px), contorno 1 px.
- Rail esquerdo: pílula vertical com `INDEX`. Rail direito: duas pílulas verticais
  empilhadas, `RING` e `GRID`; a ativa fica preta.
- A figura central respira e mexe os braços em ciclo; o movimento é lento, físico, nunca em bounce.

## Ecrã 2 — detalhe / recibo

- Título grande à esquerda (`06. STATIC`), figura ao centro com pontos pretos numerados
  (01, 02, 03) colados às peças; ao passar o rato o ponto mostra uma pílula com nome e preço.
- Recibo: painel branco encostado ao topo direito, largura ~260 px, contorno 1 px,
  borda inferior denteada (rasgada). Conteúdo todo em mono versaletes, 9–10 px:
  cabeçalho (`DROP 01 · STORE 001 · PRAGUE`), subtítulo (`LOOK 06 — STATIC`),
  linhas numeradas com nome + categoria cinzenta + pílula `ADD` tracejada,
  separadores tracejados, subtotal, desconto, `TOTAL` em 20 px, barra CTA preta
  (`ADD FULL LOOK TO BAG →`), código de barras e rodapé (`THANK YOU FOR LOGGING OFF`).
- O recibo imprime de cima para baixo (translateY + clip/máscara, ~450 ms, ease-out).
- Um X circular fechado a área, no topo da zona central.
- Toast preto de 12 px em baixo ao centro quando algo é adicionado (`PIECE SAVED TO YOUR BAG`).

## Ecrã 3 — grid

- As figuras saem do anel e assentam numa grelha (3×3), cada uma com micro-legenda;
  a transição é um flip/reflow com as mesmas posições de partida (sem corte).
- `GRID` no rail direito fica preta; `RING` volta a branco.
- A pílula `BAG (n)` atualiza a contagem.

## Ecrã 4 — index

- `INDEX` abre uma gaveta à esquerda (~33% da largura), fundo claro, régua vertical de 1 px;
  lista de looks com o ativo a cheio e os outros em cinza, `CLOSE` em pílula no topo direito,
  pílulas `STORES / JOURNAL / INSTAGRAM` no fundo. O herói continua vivo atrás.

## O que transcrevemos e o que NÃO transcrevemos

Transcrevemos a gramática: um único ecrã, interface acromática, réguas finas, mono para a
função, título grande em baixo, anel arrastável, recibo que imprime, pílulas de contorno,
rail RING/GRID, gaveta INDEX.

Não transcrevemos: a marca, os textos, os preços, os modelos, as peças de roupa. O conteúdo
é o nosso: sinais LGA com a sua ficha real.

## Tradução para o Viva Surdo (o que a página é)

- **Herói**: a Agatha (GLB atual) em palco claro, de corpo inteiro, e a assinar **OLÁ** e
  depois **BOM DIA** em ciclo, com pausa. Notação já existente:
  `'olá': 'abre alto onda'`, `'bom dia': '2:plano frente bate'` (`app/maos.js:1072`).
- **Anel**: nove cartões de sinal (não nove avatares 3D — nove GLB vivos rebentam o orçamento
  de 60 fps nesta máquina). Cada cartão: número, palavra, miniatura da forma da mão
  (`maos.js` já desenha mãos em SVG) e a confiança da fonte. Arrastar roda; o cartão da frente
  é o que a Agatha assina, sem sair de cena.
- **Título grande**: o tema do anel (`SAUDAÇÕES`), com `01 / 09` e ▶.
- **Recibo**: ficha do sinal selecionado, com os campos que existem em `app/lga.js` —
  `palavra`, `aula`, `forma`, `lugar`, `movimento`, `confianca`, `segundos`, `video`.
  Nada de preços, nada de números inventados. O código de barras é decorativo e
  desenhado a partir da `chave` (não é um código real).
- **Pílulas de baixo**: as três entradas que já existem — `TEXTO` (abre a caixa de texto),
  `AO VIVO` (liga o microfone), `DICIONÁRIO` (`#/dicionario`) — com a arte que já existe.
- **RING / GRID**: alterna anel e grelha dos mesmos nove cartões.
- **INDEX**: gaveta com a lista de temas do dicionário; escolher um tema muda o anel.
- **Palco claro**: variante clara do palco 3D (fundo `#EBE8EC`, chão a desvanecer para
  branco, sombra de contacto suave, luz frontal difusa). O palco escuro atual fica como está
  para o overlay do sinalizador.

## Restrições duras

1. Trabalhar **só** nesta worktree: `C:/Users/rafae/Documents/1-Projects/pamosii-ring`,
   ramo `ring-hello`, criado a partir de `simplify-soundfit`. **Nunca** tocar no ramo `main`,
   nem na worktree `C:/Users/rafae/Documents/1-Projects/pamosii-viva-surdo`.
2. Publicar **só** um preview: `npx --yes vercel deploy` a partir de `app/` (sem `--prod`).
   A produção (`vivasurdo.vercel.app`) tem de continuar a servir a versão atual.
3. Sem build step, sem dependências novas, sem framework. Scripts clássicos e CSS, como o resto.
4. Todos os números visíveis têm de sair de `app/lga.js`, `app/dados.js` ou `app/referencias.js`.
   Não inventar contagens, confianças, preços nem testemunhos.
5. 60 fps em desktop e em 390×844. Nada de nove canvas WebGL. Se um filtro ou desfoque
   custar frames, medir antes de aceitar.
6. `app/sw.js` `VERSAO` e **todos** os `?v=` de `app/index.html` sobem juntos (14 ocorrências).
7. Teclado e leitores de ecrã: o anel tem de ser navegável (setas), o recibo é anunciado,
   e `prefers-reduced-motion` desliga a rotação automática.
8. O rodapé mantém a frase de que os sinais não substituem uma pessoa surda, e a faixa
   Horizonte Futuro / Viva Surdo com o NIF continua intacta.

## Portas de aceitação (têm de passar antes de dizer «feito»)

```bash
cd C:/Users/rafae/Documents/1-Projects/pamosii-ring
node tools/engine-test.cjs                 # glosa continua a passar
git log --oneline -1                       # commit no ramo ring-hello
git branch --show-current                  # ring-hello
git -C ../pamosii-viva-surdo status -sb    # worktree principal intocada
npx --yes vercel deploy                    # imprime um URL de preview (sem --prod)
```

Depois do deploy, no URL de preview: `#/` mostra o anel com a Agatha a assinar OLÁ/BOM DIA;
`#/dicionario` continua a abrir; nenhum erro na consola; a contagem de `vs` no HTML bate
com a de `sw.js`.
