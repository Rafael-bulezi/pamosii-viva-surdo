# Auditoria dos botões — vs126

Data: 2026-11-08. Alvo: `https://rafael-bulezi.github.io/pamosii-viva-surdo/`
(local, servido da pasta `app/`).

Cada controlo foi aberto num Chrome real (headless novo, 1280×900), clicado, e
o estado da aplicação foi lido antes e depois do clique. O que conta como prova
é a diferença medida entre os dois estados — hash, cartões filtrados, `P.i`,
`P.beats`, reprodução, painel da sinalizadora, `disabled` dos transportes,
scroll. Um clique que não muda nada observável é tratado como falha, não como
sucesso.

Resultado: **49 controlos distintos auditados; 49 com efeito medido**. Nenhum
botão morto ficou por explicar.

## Navegação e acessibilidade

| Controlo | Intenção | Efeito medido |
|---|---|---|
| `.marca` no dicionário | voltar ao início | `#/dicionario` → `#/`; transportes passam a `disabled`; fita mostra o aviso vazio |
| nav «Sinalizar» | sair do dicionário | `#/dicionario?fonte=is` → `#/`; 298 cartões → 0 |
| nav «Dicionário» já no dicionário | voltar ao topo | scroll 64 → 0, com os dois cartões-fonte presentes |
| `#a11y-btn` | abrir o painel Aa | `a11yAberto` false → true |
| fundo escuro | alternar tema | `tema` false → true |
| escala 150% | aumentar o texto | `escala` "1" → "1.5" |

## Página Sinalizar

| Controlo | Intenção | Efeito medido |
|---|---|---|
| cartão Texto | pôr o cursor no editor | foco `BODY` → `txt`; editor acende (classe `a-piscar`) |
| cartão Legendas | abrir o seletor de ficheiro | `fich` 0 → 1 |
| cartão Dicionário | ir para o dicionário | `#/` → `#/dicionario` |
| «Ver sinais» com editor vazio | avisar, não falhar em silêncio | recado «Escreve alguma coisa para ver sinais.» e foco no editor |
| «Ver sinais» com texto | gerar a glosa | `beats` 0 → 2; começa a tocar; fita deixa de estar vazia |
| play/prev/next sem sinais | não fazer nada | `disabled` = true antes e depois; `tocando` continua false |
| «Ficheiro» | abrir o seletor de ficheiro | `fich` 0 → 1 |
| «Exemplo» | preencher e sinalizar | `txt` 0 → 38 caracteres; `beats` 0 → 13 |
| play com sinais | pausar | `tocando` true → false |
| prev | recuar um sinal | `P.i` 2 → 1 |
| next | avançar um sinal | `P.i` 0 → 1 |
| velocidade 0,5× | abrandar | `vel` 1 → 0.5 |
| chip da fita (2.º sinal) | saltar para esse sinal | `P.i` 0 → 1; transportes atualizam |
| «Abrir vídeo» | abrir o seletor de vídeo | `vid` 0 → 1 |

Nota sobre os transportes: a primeira versão do audit apanhou-os ligados com a
fita vazia — carregar em play não fazia nada porque não havia sinais. Foi isso
que motivou `atualizarTransporte()`, que desliga play/prev/next quando não há
glosa e prev/next nos extremos.

## Sinalizadora 3D

| Controlo | Intenção | Efeito medido |
|---|---|---|
| «Sinalizador 3D» | abrir com a frase de demonstração | painel aberto, 21 poses, 6 chips, a tocar |
| botão flutuante | abrir | painel aberto, 21 poses, 6 chips |
| flutuante com texto no editor | usar esse texto | glosa = «a minha casa», 4 poses, 1 chip |
| fechar | fechar o painel | `sgAberto` true → false; foco volta ao botão flutuante |
| play | pausar | `sgTocando` true → false |
| repetição | desligar | `sgRep` true → false |
| velocidade 1,5× | acelerar | `sgVel` 1 → 1.5 |
| chip 3 da glosa | saltar para o 3.º sinal | `sgT` 0 → 3 |
| «Abrir sinalizadora» no dicionário LGA | levar a pose para Sinalizar | `#/?s=oi%2Fol%C3%A1`; 4 sinais na fita |

## Dicionário

| Controlo | Intenção | Efeito medido |
|---|---|---|
| cartão LGA | entrar na LGA | 246 cartões |
| cartão International Sign | entrar no IS | 298 cartões |
| «Voltar» (IS e LGA) | voltar às fontes | cartões 298/246 → 0 |
| «Trocar» (IS→LGA e LGA→IS) | mudar de fonte | 298 ↔ 246 |
| tema «Saudações» (IS) | filtrar | 298 → 14 |
| estado pose (IS) | filtrar | 298 → 179 |
| estado referência (IS) | filtrar | 298 → 202 |
| estado sem referência (IS) | filtrar | 298 → 96 |
| busca «casa» (IS) | procurar | 298 → 3 |
| cartão open-source (IS) | abrir no painel | painel aberto com «olá» |
| aula «Aula 01» (LGA) | filtrar | 246 → 19 |
| confiança alta (LGA) | filtrar | 246 → 173 |
| busca «água» (LGA) | procurar | 246 → 1 |
| cartão de pose (LGA) | abrir no painel | painel aberto com «oi/olá» |

## O que estava errado e foi corrigido

1. **Transportes ligados sem glosa.** Play, anterior e seguinte aceitavam
   clique com a fita vazia e não faziam nada. Agora ficam `disabled`.
2. **«Ficheiro» e «Abrir vídeo» eram `<label>`**, não botões: o rato funcionava
   por acaso, o teclado não. Passaram a `<button>` que chama o input.
3. **O cartão Texto só dava foco.** Numa página longa parecia não fazer nada.
   Agora acende o painel do editor e leva-o ao centro do ecrã.
4. **«Ver sinais» ralhava com o editor já preenchido** («escreve alguma coisa»
   com texto escrito). A mensagem vazia agora distingue editor vazio de frase
   sem nenhuma palavra conhecida.
5. **O botão flutuante ignorava o texto escrito** e abria sempre a frase de
   demonstração. Agora usa o conteúdo do editor quando existe.
6. **A fita vazia era um espaço morto.** Passou a mostrar a instrução do que
   fazer.
7. **Clicar no separador onde já estamos não fazia nada.** Agora volta ao topo
   e limpa os filtros do dicionário.

Contraste: no tema escuro os «pills» dos cartões ficavam escuros sobre escuros;
foram dados valores próprios por tema (escuro e alto contraste). O cartão IS do
dicionário também estava quase vazio — o globo ganhou traço, o selo de
reprodução ficou opaco e o campo passou a azul-claro.

## Como repetir

O ensaio vive fora do repositório, em
`C:/Users/rafae/AppData/Local/Temp/vs-gestos/auditar2.cjs`. Sobe um servidor
estático sobre `app/` e um Chrome headless, percorre a lista `ITENS` e escreve
uma linha JSON por controlo em `auditoria2.jsonl` com `antes`/`depois`.
`INICIO` e `FIM` limitam o intervalo (por exemplo `INICIO=21 FIM=22`).
