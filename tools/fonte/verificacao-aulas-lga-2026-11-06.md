# Verificação do trabalho do Antigravity — aulas de LGA (2026-11-06)

O agente do Antigravity trabalhou em `C:\Users\rafae\Documents\antigravity\pamosii-viva-surdo`
(branch `antigravity`) a partir do brief `tools/fonte/brief-antigravity-aulas-lga.md`.
Esta nota regista o que foi verificado por artefactos, não pelo relatório do agente.

## O que foi feito, medido

- 3 commits (`e6584dd`, `2123642`, `55a05fe`), HEAD `55a05fe`, igual a `me/antigravity`.
- 12 aulas mineradas (as 10 obrigatórias + as 2 opcionais), 248 entradas em 12 ficheiros
  `tools/fonte/aulas-lga/*.json` — a contagem por aula bate exatamente com a tabela do `NOTAS.md`.
- Confiança: 173 alta, 63 média, 12 baixa (69,8 / 25,4 / 4,8 %) — igual ao `NOTAS.md`.
- 248 de 248 entradas têm todos os campos e uma folha `palavra-*.png` existente no disco
  (verificado com script: 0 folhas em falta).
- 311 folhas em `.mine/` (122 MB), fora do git como o brief mandava. Legendas de 13 aulas.
- `node tools/integridade-test.cjs` e `node tools/engine-test.cjs` passam.
- Nenhum ficheiro de `app/` foi tocado; nenhuma notação escrita; nada publicado. O brief pedia isso.

## Folhas conferidas à vista

- `casa-1/palavra-casa.png` — mãos em telhado acima da cabeça; legenda «Casa» no quadro. Descrição correta.
- `comida-1/palavra-funge.png` — punhos a bater a massa; legenda «Funge». Descrição correta.
- `dialogo-01/palavra-onde-voce-nasceu-1.png` — **não** mostra o que o JSON diz. O JSON aponta
  para o interlocutor «na janela pequena»; a folha recorta o quadro principal, onde não se vê
  sinal nenhum. O mesmo deve acontecer às outras entradas marcadas `baixa` do diálogo.

## Cobertura no glossário (dados juntos, verificado)

`python tools/cobertura-lga.py` depois do merge: **55 de 297 palavras do glossário passam a ter
fonte LGA de vídeo** (54 alta, 1 média — «nunca»). Antes, o «visto no vídeo» era só Sématos,
que é International Sign. 192 itens do inventário ainda não estão no glossário (letras do
abecedário, numerais em algarismo, frases do diálogo, variantes sem acento como `feijao`/`pao`).

## O que falta

1. As 12 entradas `baixa` do `dialogo-01` não são verificáveis pelas folhas entregues: é preciso
   recortar a janela pequena (PiP) em vez do quadro principal.
2. Normalizar ao integrar: algarismos 1–90, letras `letra-a`… e variantes sem acento para as formas
   do glossário; `[Bravo]` é aplauso de fecho, não vocabulário.
3. O inventário não está ligado à app — é matéria-prima com evidência, como o brief previa.

## Registo git

Merge de `me/antigravity` em `simplify-soundfit` (commit de merge próprio), sem tocar em `app/`.
A branch `antigravity` fica como está; o Antigravity deve fazer `git fetch me` + merge antes de
voltar a mexer, como diz o `AGENTS.md`.
