# AGENTS.md — Pamosii Viva Surdo

Este repositório é trabalhado em **dois lugares** na mesma máquina. Lê isto antes
de mexer em seja o que for.

## O que é

SPA em JavaScript puro, sem build e sem `npm install`: `app/index.html` carrega
scripts clássicos (`app.js`, `avatar.js`, `sinal3d.js`, `maos.js`, `dados.js`,
`referencias.js`, `lga.js`) e um three.js **r147** em `app/vendor/`. O apresentador 3D é
`app/assets/agatha-mpfb-rig.glb` (13,8 MB, 55 ossos com nomes VRM) — nunca apagar.

`app/lga.js` é **gerado**: `python tools/gerar-lga.py` lê
`tools/fonte/aulas-lga/*.json` (inventário minerado das aulas do Viva surdo) e
escreve o ficheiro. Não editar à mão; o `integridade-test.cjs` compara os dois e
chumba se divergirem.

## Comandos

```
node tools/integridade-test.cjs   # chumba se as três camadas se separarem
node tools/engine-test.cjs        # 10 frases glosadas
node tools/serve.cjs              # http://localhost:8123
```

Publicar: mudar `const VERSAO` em `app/sw.js` **e** os 10 `?v=` em `app/index.html`
para o mesmo valor, correr os dois testes, depois `README.md` → secção
Publicação. O service worker não guarda o GLB.

## Regras que não se partem

- **Nunca apresentar gestos plausíveis como sinais verificados.** Só dizer «visto
  no vídeo» quando a palavra está no caderno com descrição do que se vê
  (`tools/fonte/auditoria-render.json`, `tools/fonte/is-comparado.json`). O que a
  fonte não documenta fica sem referência e o cartão diz isso.
- É **LGA** (Língua Gestual Angolana), nunca LGP. Nunca «pessoas normais». O
  rodapé mantém literalmente que os sinais «não substituem» uma pessoa surda.
- Sem números não medidos na interface (nada de tiers, rankings ou counts
  inventados), sem preços nem testemunhos inventados.
- `marketing/` não é nosso — não tocar. `tools/sonda-*.cjs`, `zoom-mao.cjs`,
  `glb-lab/` e `~/glb-lab` são material de laboratório: não se commitem.
- Se ligares o Vercel, **apagar `app/.env.local` a seguir** — o CLI escreve lá um
  `VERCEL_OIDC_TOKEN` e sobe como ficheiro público.
- Commit e push de cada alteração, sem esperar que alguém peça.

## Protocolo das duas workspaces

| local | caminho | branch |
|---|---|---|
| Qoder | `C:\Users\rafae\Documents\1-Projects\pamosii-viva-surdo` | `simplify-soundfit` |
| Antigravity | `C:\Users\rafae\Documents\antigravity\pamosii-viva-surdo` | `antigravity` |

1. Antes de começar: `git fetch me && git log --oneline me/simplify-soundfit -5` e
   integra o que o outro lado fez (`git merge me/simplify-soundfit`) antes de
   escrever código.
2. Cada lado só trabalha na sua branch e só faz push da sua:
   `git push me <a-tua-branch>`. Nunca `--force`, nunca partir a branch do outro.
3. Publicar (gh-pages + Vercel) faz-se **de um lado só por vez**, e quem publica
   escreve a versão no `README.md`. Se estiveres no Antigravity e a versão do
   `README.md` for mais recente do que o que tens ao lado, puxa primeiro.
4. O repositório de origem `7Dark7Cloud7` é só de leitura (push devolve 403). O
   remote de publicação chama-se `me` e é `https://github.com/Rafael-bulezi/pamosii-viva-surdo`.

## Onde está a verdade do estado

`README.md` (o que é a app e como se publica) e
`tools/fonte/qc-personagem-2026-11-03.md` (medidas do pulso, do personagem, do
palco vs117 e estado dos 191 sinais). `tools/fonte/avatares-candidatos-2026-11-04.md`
é a lista de modelos 3D alternativos com preços e prova de ossos.
`tools/fonte/verificacao-aulas-lga-2026-11-06.md` é a verificação por artefactos
do inventário LGA. Se mudares um número, um caminho ou uma versão, actualiza
estes ficheiros todos.
