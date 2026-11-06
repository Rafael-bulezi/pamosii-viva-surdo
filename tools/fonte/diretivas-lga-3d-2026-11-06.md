# Diretivas do coordenador — LGA 3D (2026-11-06)

Plano aprovado com estas correções. Segue-as à letra.

1. **Fotogramas:** o caminho certo é a raiz do repositório,
   `.mine/<aula>/palavra-<slug>.png` — não `tools/fonte/...`. São 311 folhas de
   3 fotogramas, com os segundos no cabeçalho. Para cada palavra, abre a folha
   dessa palavra (ex.: `.mine/saudacao/palavra-oi-ola.png`, em
   `C:\Users\rafae\Documents\antigravity\pamosii-viva-surdo`) e usa os
   `segundos` exatos do `lga.js`. O `veSe` é pista, não prova: sem abrir a
   folha, a palavra não conta como vista.
2. **Lotes:** divide o Lote 1 em **1a = Aula 01 (19 palavras)** e
   **1b = Aula 03 (27)**. Faz o 1a de ponta a ponta (dados, UI, teste, registo,
   capturas, commit+push) antes de começar o 1b. Depois continua aula a aula
   sem esperar aprovação; só paras se uma aula inteira estiver ilegível ou
   houver bloqueio de rig.
3. **Numerais:** 27 itens do Lote 1 são números. Se a forma da mão não existir
   nas 32 formas, não aproximes em silêncio: ou acrescentas uma forma medida em
   `maos.js` (com prova de render e teste), ou marcas `sem pose` com o motivo.
   Para o 1 usa `aponta` se for mesmo isso.
4. **UI:** o selo verde é um `<button>` **irmão** do `<a class="cartao">`
   (como `.cartao-video`), nunca dentro do link. O cartão continua a abrir o
   YouTube; o botão toca a pose. Cria `abrirSignerNotacao(notacao, rotulo)` (ou
   equivalente) para tocar a notação sem depender do glossário; o painel não
   mostra selos IS.
5. **Versão:** não mudes `VERSAO` nem os `?v=` (o lado Qoder publica e sobe a
   versão). Acrescenta `lga-3d.js?v=vs118` ao `index.html` e à lista do `sw.js`;
   o teste deve aceitar isso.
6. **Registo:** `SINAIS_LGA` copia `aula`, `segundos`, `confianca` e `veSe`
   exatamente de `lga.js`; o teste de integridade compara os dois para evitar
   deriva. Cada linha do registo diz `pose` / `aproximado` / `sem pose`, o
   motivo, a folha consultada e os segundos vistos.
7. **Rig:** se o sinal exige contacto com o corpo, as duas mãos ou um movimento
   que o rig não faz, `sem pose` — não inventes nem aproximes.
8. **Prova:** captura o palco 3D na forma principal de cada pose (folha de
   contacto por lote). Se não conseguires renderizar, di-lo explicitamente;
   não declares verificação visual.
9. **Commits:** um commit por lote em `me antigravity`; inclui o brief e estas
   diretivas no primeiro. Sem `--force`. Corre os dois testes antes de cada
   commit.
10. **Relatório por lote:** poses, `sem pose` e motivos, caminho do registo e
    das capturas, saída dos testes, sha.
