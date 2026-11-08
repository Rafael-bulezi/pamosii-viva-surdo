# Tradução ao vivo — design (2026-11-08)

## Objectivo

O painel da sinalizadora passa a poder acompanhar alguém a falar. O Chrome
transcreve o português em segundo plano, uma chamada ao LLM escolhe os sinais
que existem no léxico, e a sinalizadora toca-os em sequência, um a dois segundos
atrás da voz.

## Não-objectivos

- Não é interpretação simultânea nem LGA validada: continua a ser a glosa de
  estudo, agora escolhida por significado em vez de palavras soltas.
- O LLM não inventa movimentos. Só pode escolher entre os sinais com `notacao`
  em `maos.js`; o que não estiver no léxico é soletrado ou cai.
- Sem gravação de áudio, sem histórico, sem contas de utilizador.

## Interface

Os três cartões ficam na página inicial. Texto e Traduzir ao vivo abrem por
cima dela; só o Dicionário muda de vista, como hoje.

1. **Texto** abre um *light box* sobre a página (diálogo modal com véu), com
   duas abas: **Escrever** (textarea, contagem de palavras, `Ver sinais`,
   `Exemplo`) e **Carregar ficheiro** (`.txt`, `.srt`, `.vtt`, `.pdf`, o leitor
   que já existe). Fechar devolve a home; `Esc` fecha; o foco fica preso no
   diálogo enquanto está aberto. Ao carregar em `Ver sinais`, o diálogo fecha e
   o painel abre com a glosa.
2. **Traduzir ao vivo** abre o mesmo painel da sinalizadora em *modo ao vivo*:
   um botão de microfone, uma linha de transcrição (cinzenta enquanto
   provisória, tinta quando fechada) e o palco a tocar os sinais das frases já
   fechadas. Fechar o painel pára o microfone.
3. **Dicionário** continua a ser uma ligação para `#/dicionario`.

A caixa «Frase de demonstração» e a caixa de escrita por baixo dos cartões
desaparecem.

## Painel

Largura `min(430px, calc(100vw - 24px))`, altura `84dvh`. O palco azul ocupa
**85% da altura do painel** (flex, o resto é cabeçalho, transporte e nota numa
linha); os chips da glosa flutuam por cima do fundo do palco em vez de ocuparem
altura própria. Com o painel mais estreito e mais alto, a folga da câmara desce
para ~1,00 para a figura continuar a encher o quadro sem cortar os braços.

## Arquitectura

```
microfone ──► Chrome SpeechRecognition (pt-PT, contínuo, resultados provisórios)
                    │  frase fechada
                    ▼
              POST /api/sinais  { frase }
                    │  Vercel Function (Node, key no servidor)
                    ▼
              OpenRouter (modelo flash barato, JSON)
                    │  { sinais: ["olá", "professor", …] }
                    ▼
        sinalNotacao(palavra) ──► fila de beats ──► SG / AVATAR
```

### Endpoint `api/sinais.js`

- `POST` com `{ frase: string }`, máximo 300 caracteres; 400 se vazio ou longo.
- A lista de sinais escolhíveis é um retrato gerado do código
  (`tools/gerar-sinais-llm.cjs` → `api/sinais-lista.json`: palavra + tema de
  todas as `ENTRADAS` com `notacao`). O teste de integridade falha se o retrato
  ficar diferente do léxico.
- Prompt: glosador de estudo; escolher só palavras da lista; até 8 sinais, pela
  ordem em que se sinalizam (artigos e preposições caem, o «não» vai ao fim);
  responder apenas JSON `{"sinais":[…]}`. `temperature: 0`.
- Modelo: `google/gemini-2.5-flash-lite` por omissão, mudável por
  `SINAIS_MODELO`. Falha do fornecedor → 502.
- Limite: 20 pedidos por minuto por IP (contador em memória do processo) e
  `max_tokens` curto. Custo medido: ~1,5–2 mil tokens de entrada por frase,
  ≈ 0,0001 USD por frase com flash-lite.
- A chave vive em `OPENROUTER_API_KEY` na Vercel; nunca no repositório nem no
  browser.

### Cliente

- `aoVivo.js` (novo, carregado só quando o modo abre): encapsula
  `SpeechRecognition` (prefixo `webkit`), reinicia depois de silêncios do
  Chrome, expõe `iniciar()` / `parar()` / `aoFechar(frase)`.
- Cada frase fechada vai para `/api/sinais`; a resposta é convertida com
  `sinalNotacao` e entra numa fila que o painel toca sem reabrir.
  Frases provisórias só aparecem na linha de transcrição.
- **Recuo:** se o pedido falhar (Pages, sem rede, 4xx/5xx) a frase é glosada
  pelo motor de regras actual (`analisarEmBeats`) e o painel mostra um aviso
  discreto «modo simples». O modo ao vivo nunca fica sem sinal enquanto houver
  transcrição.

## Privacidade e limites

O Chrome envia o áudio para os servidores da Google para transcrever; o texto
da frase segue para o fornecedor do modelo. Ambas as coisas ficam escritas na
nota do painel quando o modo ao vivo abre. Sem reconhecimento de fala no
navegador (Firefox), o painel explica e oferece o fluxo de Texto.

## Testes

- `tools/sinais-test.cjs`: validação do handler (vazio, longo, JSON inválido),
  recuo 502 com fornecedor em baixo (fornecedor falso por variável de ambiente),
  e o retrato do léxico em sincronia.
- Integridade: nova entrada para `api/sinais-lista.json` e para a versão.
- Browser local, com `SpeechRecognition` e `fetch` substituídos por duplos:
  provisório → cinzento; fechado → pedido; resposta → fila toca dois sinais;
  falha → motor de regras + «modo simples»; fechar pára o microfone.
- Medições: painel 430×756 a 1280×900, palco = 85% ± 1%, buffer do canvas igual
  ao CSS; light box centrado, `Esc` fecha, `Tab` não sai; 390×844 e ecrã
  inteiro. O microfone real não é testável por máquina — fica dito no relatório.

## Publicação

Versão nova (`vs13x`) em `sw.js` e nos `?v=` do `index.html`; deploy para Pages
(o modo ao vivo recua para regras) e Vercel (com a função e a chave). O README
ganha a secção do modo ao vivo, com custo, privacidade e o que fica por validar.
