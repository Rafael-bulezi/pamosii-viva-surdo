# QC do personagem e estado dos sinais — 2026-11-03

**Pergunta do autor:** «não é só para acertar os sinais IS — é também ver como o
personagem funciona, quão bom ele é; o pulso é fino em alguns ângulos? E os sinais
precisam de ser exactos.»

Este documento responde com medidas, não com impressões. Nada aqui foi commitado nem
publicado.

## 1. O pulso

### 1.1 Como foi medido

`~/glb-lab/medir-punho-glb.cjs` lê o GLB que a app carrega
(`app/assets/agatha-mpfb-rig.glb`, 13 841 128 bytes, 2026-10-31 11:31), aplica a pele
por linear blend skinning e mede o raio dos vértices de pele num cilindro de ±30 mm em
torno do osso do pulso, ao longo do eixo do antebraço.

Convenção de matrizes provada, não suposta: `jointWorld · inverseBindMatrix = I` com
erro 0,000 só com a 3×3 do quaternião transposta (na convenção directa o erro era
1,97 e o pulso aparecia em y = −0,71, fora do corpo). O pulso real fica em
(−0,479, 1,045, 0,213) m, dentro da malha.

### 1.2 Resultados (mão direita = a mão que assina; esquerda espelhada)

| medida | direita | esquerda |
|---|---|---|
| diâmetro mediano do pulso, em repouso | **55,1 mm** | 55,0 mm |
| raio p10 / p90, em repouso | 22,2 / 33,1 mm | 22,2 / 33,0 mm |
| largura lateral (silhueta), em repouso | 54,3 mm | 54,3 mm |
| espessura ântero-posterior, em repouso | 53,5 mm | 53,5 mm |
| largura da mão na base dos metacarpos | 80,7 mm (com polegar) | 63,4 mm (só palma) |
| antebraço (cotovelo→pulso) | 270,7 mm | 270,7 mm |
| pulso→base do dedo médio | 109,0 mm | 109,0 mm |

Perfil de raio mediano ao longo do antebraço (t = 0 no pulso, negativo para o cotovelo),
só pele, sem manga:

| t (mm) | −100 | −50 | −30 | −10 | 0 | +10 | +20 | +30 | +40 |
|---|---|---|---|---|---|---|---|---|---|
| raio (mm) | 29,9 | 25,8 | 28,5 | 26,8 | **27,0** | 29,1 (D) / 27,3 (E) | 28,7 / 31,0 | 28,8 / 28,6 | 33,6 / 32,1 |

Não há degrau: o pulso (27,0 mm de raio) é 5–10 % mais estreito do que o antebraço a
5 cm dele (25,8–28,5 mm) e do que a palma a 4 cm (32–34 mm). A razão pulso/mão é
**0,68** contra a mão inteira (com polegar) e **0,87** contra a palma só — o alvo
antropométrico de 0,72 fica entre os dois. **O pulso não é fino em repouso.**

### 1.3 Com a mão flectida

| flexão | diâmetro mediano | raio p10 (zona mais estreita) | p90 |
|---|---|---|---|
| 0° | 55,1 mm | 22,2 mm | 33,1 mm |
| 30° | 53,6 mm | 21,5 mm | 57,8 mm |
| 60° | 55,5 mm | **17,0 mm** (34 mm de diâmetro) | 76,9 mm |

A 60° a prega interna estreita 23 % (raio 22,2 → 17,0 mm) e o dorso incha — é o efeito
«candy wrapper» do linear blend skinning, não da geometria. Renderizado com normais
suaves (`~/glb-lab/render-pulso.cjs`, rasterizador próprio, 0,9 s para 6 imagens),
a 0° e 30° lê-se como um pulso humano; a 60° vê-se a dobra, mas não invalida a pose.

Imagens: `~/glb-lab/shots/pulso-D-{lateral,palma}-{0,30,60}.png`.

### 1.4 Porque é que a fotografia parecia mostrar um pulso fino

A fotografia que motivou a queixa, `~/glb-lab/shots/idle-hands-closeup-01.png`, é de
**2026-10-31 08:04**. O GLB com o pulso engrossado é de **2026-10-31 11:31** — a imagem
é 3 h 27 min anterior à correcção. O GLB publicado
(`https://vivasurdo.vercel.app/assets/agatha-mpfb-rig.glb`) tem exactamente os mesmos
13 841 128 bytes do local, portanto o site já serve a malha corrigida.

## 2. O personagem no resto

- Malha MakeHuman/MPFB: 66 nós, 10 malhas, 1 skin com 55 articulações, sem animações.
- Proporções medidas: antebraço 270,7 mm, pulso→metacarpo 109 mm, altura do corpo
  ≈ 1,78 m (caixa da malha 0,94–1,78 m; cabelo até 1,78 m). Braço e mão estão dentro
  das proporções humanas usuais.
- A geometria do pulso já foi engrossada no pipeline (`tools/melhorar-rig.py`,
  `GANHO = 0.0045`, 4,5 mm radiais numa banda de −55 a +30 mm).

### 2.1 Personagem inteiro, renderizado com as texturas do GLB

`~/glb-lab/render-personagem.cjs` aplica skinning às 10 malhas e rasteriza em Node puro
(2,0 s, 154 996 triângulos por vista), amostrando as texturas do GLB com as UV de cada
peça. Cinco vistas:

- `~/glb-lab/shots/corpo-frente.png` · `corpo-3q.png` · `corpo-perfil.png` (quadro de
  1,95 m, 620×900)
- `~/glb-lab/shots/cabeca-frente.png` · `cabeca-3q.png` (quadro de 0,34 m, 560×620)

O que se vê, agora fiel ao que a app mostra:

- **Roupa real:** camisola verde (textura `camisola-verde`, cor ~[25,100,86]), calças
  de ganga azul (~[53,85,117]) e sapatilhas brancas. As costuras e bolsos vêm da
  textura; a risca clara no ombro também é da textura, não um defeito de material.
- **Olhos:** íris castanha (textura `olhos`) — no primeiro teste pareciam brancos por
  um erro meu de índice de UV no rasterizador (lia sempre o texel 0,0), já corrigido.
- **Proporções:** altura 1,796 m (caixa −0,017 a 1,779 m); ombros (origens dos
  `UpperArm`) a ±0,183 m → 0,366 m; anca a 0,911 m; base do pescoço a 1,463 m; cabeça
  a 1,559 m. Braços e pernas dentro do habitual para 1,80 m.
- **Roupa justa:** a malha `female_casualsuit01` é uma pele ajustada ao corpo, por isso
  as calças lêem-se como ganga muito justa. Não há clipping visível nas cinco vistas,
  nem no colarinho nem na cintura.
- **Cara:** íris, sobrancelhas, pestanas, lábios e orelha projectam-se bem; a linha do
  cabelo é baixa e o afro tem uma costura facetada visível a 3/4 (a malha `AfroMalha`
  não tem textura, só cor).
- **Pose de repouso:** braços ~30° abaixo da horizontal, ligeiramente à frente, palmas
  para cima. As transformações de repouso R/L são espelhadas exactamente (quaterniões
  de `Hand`, `LowerArm`, `UpperArm` com x igual e y/z negados). Só dois dedos fogem:
  `Index1` esquerdo +4,9° e `Thumb1` esquerdo +5,5° em relação ao direito. É
  sub-visível e as poses somam rotações por cima; não mexi para não mexer nos 191
  sinais sem nova verificação visual.

Limites do método: é a pose de repouso, não as poses dos sinais; só usa a textura
difusa (sem normal map); projecção ortográfica.

**Veredicto:** o personagem está bom para apresentador — proporções adultas, cara
legível, roupa coerente e mãos dentro da escala. O único defeito geométrico medido
continua a ser a prega do pulso a 60° de flexão (−23 % no raio p10), que é skinning e
não se vê nas poses normais.

## 3. Estado dos sinais (191 sinais desenháveis)

Fonte: `tools/fonte/auditoria-render.json` (2026-11-01), mais a correcção `varre` de
2026-11-02. Veredictos por palavra: **123 ambíguo · 55 verificar-visual · 13 errado**.

Os 13 «errado» são exactamente os 13 sinais imóveis (< 0,5° de movimento total):
`carteira`, `cinza`, `pequeno`, `cama`, `quarto`, `março`, `abril`, `junho`,
`setembro`, `novembro`, `dezembro`, `telefone`, `igreja`. Todos têm `parado` na
notação — são fotografias, não animações.

O veredicto «errado» vem da regra de imobilidade, não de uma pose errada. Onde há
vídeo da fonte para confirmar (`tools/fonte/is-comparado.json`):

- `pequeno` — o vídeo diz «indicador e polegar deixam um dedo de distância entre
  si, junto ao queixo, **e ficam parados**». O sinal IS é mesmo uma pose
  estática: `F queixo parado` é fiel, não um defeito.
- `telefone` — o vídeo diz «mão em Y **sobe à orelha e fica**». Há uma
  aproximação antes da pausa; a notação `Y orelha parado` guarda a pose final
  (comparação `igual`) e perde o movimento de subida. É o único dos 13 em que
  a referência mostra movimento que a notação não tem.
- Os outros 11 não têm referência IS; a imobilidade deles não pode ser julgada
  quanto à fidelidade, só quanto ao efeito visual.

Outros defeitos medidos:

| defeito | sinais | quais |
|---|---|---|
| sem qualquer rotação (palma e dedos < 5°) | 15 | os 13 acima + `orelha`, `cabelo` (`toque`) |
| palma parada, dedos rodam | 8 | `olá`, `tchau`, `falar em lga`, `peixe`, `autocarro`, `música`, `dança`, `esperar` |
| pares indistinguíveis (mãos a < 10°) | 241 pares, 59 abaixo de 3° | ver auditoria de 2026-11-01 |

Testes do repositório, corridos hoje: `engine-test` OK (10 frases glosadas);
`integridade-test` OK (191 sinais desenháveis, 298 palavras, 179 cartões, 83 selos de
pose para o vídeo IS, 202 ligações ao léxico Sématos, versão vs115).

## 4. O que não foi feito

- Não mexi no renderizador da app nem na notação: qualquer alteração de pose precisa de
  verificação visual.
- Não autoriei os keyframes dos 13 sinais imóveis nem separei os 241 pares: sem
  referência por palavra seria inventar gestos, e a regra é nunca apresentar gestos
  plausíveis como sinais verificados. Dos 13, só `pequeno` e `telefone` têm referência
  IS (`REFERENCIAS_IS`, ambos já comparados); `pequeno` é estático na própria
  referência, `telefone` só perde a subida até à orelha; os outros 11 não têm
  referência IS nenhuma e dependem do léxico LGA/validação surda (tarefa INEE).
- Não commitei, não publiquei, não apaguei nada. Ficam por apagar, antes de publicar,
  os artefactos de laboratório não rastreados `tools/sonda-punho.cjs`,
  `tools/zoom-mao.cjs` e a pasta `~/glb-lab`.

## 5. Próximo passo recomendado

1. **Pulso:** nenhum. A medida está dentro do alvo e o que se vê a 60° é skinning, não
   geometria. Se o autor continuar a achar fino, o ajuste é de pipeline
   (`GANHO` 0.0045 → 0.0060 e banda alargada para −70 mm), com reconstrução do GLB em
   Blender e nova bateria de imagens.
2. **Os 13 imóveis:** `pequeno` fica como está — é estático na referência IS. Para
   `telefone`, autorar a subida até à orelha a partir do vídeo (opção B), não um
   `parado` com movimento falso. Os outros 11 precisam de referência LGA e de
   validação antes de qualquer keyframe.
3. **Os 241 pares:** separar as famílias `2:plano frente *` (15 palavras) e
   `plano peito *` (9) com palmas e alturas distintas por palavra.
