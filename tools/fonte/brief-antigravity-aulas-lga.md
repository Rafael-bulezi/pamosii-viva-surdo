# Brief — minerar as aulas de LGA do canal Viva surdo

Este ficheiro é para o agente do Antigravity. Trabalha **só** em
`C:\Users\rafae\Documents\antigravity\pamosii-viva-surdo` (branch `antigravity`).
Não toques em `C:\Users\rafae\Documents\1-Projects\pamosii-viva-surdo` — essa é a
outra workspace do mesmo projecto. Lê o `AGENTS.md` na raiz antes de começar.

## Objectivo

As 14 aulas do «Mini curso de LGA» mostram cada sinal **com a palavra escrita em
grande no rodapé do quadro**. Isso dá-nos a primeira fonte verdadeira de LGA
angolana: hoje o que temos de «visto no vídeo» vem do Sématos, que é International
Sign, outra língua.

O que esta tarefa produz é um **inventário do que a aula ensina**, palavra a
palavra, com o que se vê no quadro e em que segundos. **Não escrever notação, não
mexer em `app/*.js`, não publicar.** A notação decide-se depois, com revisão
humana.

## Ferramenta

Já está no repositório: `tools/minar-aula.py` (usa `yt-dlp`, o ffmpeg do pacote
`imageio-ffmpeg` e Pillow — os três já instalados nesta máquina).

```
python tools/minar-aula.py baixar <id-do-video> <slug>
#  -> .mine/<slug>/quadros/q001.png… (1 fotograma por segundo)
#  -> .mine/<slug>/legendas.png      (rodapé de cada segundo, numerado)

# ler legendas.png e escrever .mine/<slug>/tempo.json, ex.:
#   {"branco": [0, 2], "preto": [5, 8], "azul": [21, 24]}

python tools/minar-aula.py recortes <slug> .mine/<slug>/tempo.json
#  -> .mine/<slug>/palavra-<palavra>.png (início, meio, fim de cada palavra)
```

Há um exemplo já feito, com o qual te podes comparar:
`.mine/cores/` (aula 05, Cores) com `tempo.json` e nove folhas `palavra-*.png`.

## Aulas a minerar (nesta ordem, uma de cada vez)

| ordem | id | slug | aula | duração |
|---|---|---|---|---|
| 1 | `fbsKSkuvXa4` | `partes-do-corpo` | Aula 14 — As partes do corpo | 50 s |
| 2 | `Wp-qBtsw4uA` | `verbos-2` | Aula 10 — Verbos de LGA 2 | 55 s |
| 3 | `Gn3FyAYlMQY` | `dialogo-01` | Diálogo 01 | 101 s |
| 4 | `F-ZMpMJFF7A` | `numeros` | Aula 03 — Números | 145 s |
| 5 | `AOSjmGxMfGI` | `verbos-1` | Aula 06 — Verbos de LGA 1 | 148 s |
| 6 | `7MNX--Xh0V8` | `casa-2` | Aula 12 — Casa (2ª parte) | 157 s |
| 7 | `7Tuc_i7QgNo` | `tempos-meses` | Aula 13 — Tempos e Meses | 174 s |
| 8 | `XyGt-yaHJkA` | `saudacao` | Aula 01 — Saudação de LGA | 190 s |
| 9 | `tzhRtS3zs78` | `casa-1` | Aula 11 — Casa (1ª parte) | 191 s |
| 10 | `NxqSSU2LK-w` | `comida-2` | Aula 08 — Comida e Bebida (2ª parte) | 205 s |

Se chegares ao fim com tempo e disco, acrescenta `xBhXm0ubMS0` (Abecedário, 237 s)
e `pl0P1LmoW3Q` (Comida 1, 255 s). Não passes destes 12.

## Disco e carga (importante)

O disco C: tem **menos de 3 GB livres** e o portátil está fraco. Por aula:
apaga o `.mine/<slug>/quadros/` **logo depois** de gerar as folhas
`palavra-*.png`, e faz tudo **sequencial** — nunca dois downloads ao mesmo tempo.
As folhas por palavra ficam guardadas; os fotogramas não.

## O que escrever por palavra

Um ficheiro por aula: `tools/fonte/aulas-lga/<slug>.json`, com uma entrada por
palavra:

```json
{
  "aula": "Aula 14 — As partes do corpo de LGA",
  "video": "https://www.youtube.com/watch?v=fbsKSkuvXa4",
  "fonte": "Viva surdo (canal oficial)",
  "palavras": [
    {
      "palavra": "cabeça",
      "segundos": [12, 15],
      "folha": ".mine/partes-do-corpo/palavra-cabeca.png",
      "ve-se": "mão aberta com os dedos juntos a tocar o topo da cabeça, sem movimento",
      "forma-da-mao": "aberta / dedos juntos",
      "lugar": "topo da cabeça",
      "movimento": "parado",
      "confianca": "alta",
      "duvida": ""
    }
  ]
}
```

Regras de honestidade, estas não se negociam:

- A palavra vem **só** da legenda escrita no quadro. Se não houver legenda, ou se
  a legenda cobrir duas palavras, escreve isso em `duvida` e `confianca: baixa`.
- A resolução máxima que o YouTube serve sem sessão é 540×360. Se não consegues
  ver os dedos com clareza, diz `confianca: média` e descreve apenas o que vês.
- **Nunca inventar nem «adivinhar» o sinal.** Um campo `ve-se` plausível mas errado
  vale pior do que um campo vazio.
- Não copies descrições do Sématos nem de outra língua para dentro destes ficheiros.
- Um ficheiro `tools/fonte/aulas-lga/NOTAS.md` no fim, com: quantas palavras por
  aula, split de confiança (alta/média/baixa), que aulas correram, o que falhou.

## Fecho

1. `node tools/integridade-test.cjs` e `node tools/engine-test.cjs` têm de continuar
   a passar (não alteraste código, por isso devem).
2. `git add tools/fonte/aulas-lga && git commit && git push me antigravity`.
   Só `tools/fonte/aulas-lga/` — os PNG ficam em `.mine/`, fora do git.
3. Reporta no fim, em português: tabela de aulas, nº de palavras por aula,
   split de confiança, e a lista das palavras que ficaram em `confianca: baixa`
   para revisão humana.
