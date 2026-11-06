# Notas de Mineração — Aulas de LGA (Viva surdo)

Este documento resume o processo de extração e catalogação visual de vocabulário da Língua Gestual Angolana (LGA) a partir das aulas em vídeo disponibilizadas pelo canal oficial **Viva surdo** no YouTube.

Todo o trabalho foi realizado de forma estritamente sequencial, analisando os fotogramas extraídos a 1 fps e folhas de contacto por palavra, preservando o vocabulário autêntico do canal sem decalque de outras línguas gestuais.

---

## 1. Tabela de Aulas Mineradas

| # | Slug | Aula / Título | ID YouTube | Duração | Total Palavras |
|---|---|---|---|---|---|
| 1 | `partes-do-corpo` | Aula 04 — Partes do Corpo | `fbsKSkuvXa4` | 50 s | 9 |
| 2 | `verbos-2` | Aula 03 — Verbos (2ª parte) | `Wp-qBtsw4uA` | 55 s | 6 |
| 3 | `dialogo-01` | Aula 14 — Diálogo (1ª parte) | `Gn3FyAYlMQY` | 101 s | 27 |
| 4 | `numeros` | Aula 02 — Números | `F-ZMpMJFF7A` | 145 s | 27 |
| 5 | `verbos-1` | Aula 03 — Verbos (1ª parte) | `AOSjmGxMfGI` | 148 s | 27 |
| 6 | `casa-2` | Aula 12 — Casa (2ª parte) | `7MNX--Xh0V8` | 157 s | 20 |
| 7 | `tempos-meses` | Aula 09 — Tempos e Meses | `7Tuc_i7QgNo` | 174 s | 21 |
| 8 | `saudacao` | Aula 01 — Saudação de LGA | `XyGt-yaHJkA` | 190 s | 19 |
| 9 | `casa-1` | Aula 11 — Casa (1ª parte) | `tzhRtS3zs78` | 191 s | 22 |
| 10 | `comida-2` | Aula 08 — Comida e Bebida (2ª parte) | `NxqSSU2LK-w` | 205 s | 22 |
| 11 | `abecedario` | Aula 00 — Abecedário em LGA | `xBhXm0ubMS0` | 237 s | 25 |
| 12 | `comida-1` | Aula 07 — Comida e Bebida (1ª parte) | `pl0P1LmoW3Q` | 255 s | 23 |
| **TOTAL** | | **12 aulas** | | **1 908 s** | **248 palavras** |

---

## 2. Estatísticas Globais

- **Total de aulas processadas**: 12 (10 aulas do plano principal + 2 aulas opcionais completas).
- **Total de termos/palavras catalogados**: 248.
- **Distribuição de Confiança**:
  - **Alta**: 173 palavras (69,8%) — Formato manual, orientação e trajetória nítidos no vídeo principal.
  - **Média**: 63 palavras (25,4%) — Subtilezas digitais (ex: números e dezenas em 360p, soletração rápida em datilologia ou pratos compostos da gastronomia angolana).
  - **Baixa**: 12 palavras (4,8%) — Interlocutor remoto em janela miniatura (Picture-in-Picture) no diálogo de videochamada.

---

## 3. Palavras com Confiança Baixa (Revisão Humana Prioritária)

Todas as 12 entradas com confiança `baixa` pertencem à **Aula 14 — Diálogo (1ª parte)** (`dialogo-01.json`), onde as respostas do interlocutor surdo (Eduany) ocorrem numa janela pequena no canto superior direito do ecrã, dificultando a leitura de configurações digitais subtis:

1. `Qual é o seu nome?` — Pergunta em janela pequena de videochamada.
2. `Meu nome é E-D-U-A-N-Y` — Soletração datilológica na janela remota comprimida.
3. `Onde você nasceu?` — Pergunta na janela remota.
4. `Eu nasci em Namíbia.` — Resposta na janela miniatura.
5. `N-A-M-Í-B-I-A` — Soletração de país na janela pequena.
6. `Você mora com seus pais?` — Sinalizado na janela remota.
7. `moro com minha família.` — Sinal composto na janela remota.
8. `Quantos irmãos você tem?` — Sinal na janela remota.
9. `Eu tenho 5 irmãos, sendo 3 homens e 2 mulheres.` — Estrutura numérica e de género na janela remota.
10. `Qual é o sinal do seu nome?` — Pergunta de sinal de batismo na janela pequena.
11. `(Sinal do nome do Milton)` — Batismo gestual atribuído ao interlocutor.
12. `Prazer em conhecê-lo.` — Fórmula de despedida na janela remota.

---

## 4. Palavras com Confiança Média Dignas de Confirmação por Falante Nativo de LGA

Abaixo destacam-se os termos onde a forma base foi observada, mas há particularidades culturais, datilológicas ou de resolução que requerem validação humana antes da geração de glifos definitivos:

### A. Gastronomia e Pratos Tradicionais Angolanos (`comida-1` e `comida-2`)
- **`funge`**: Sinal icónico e expressivo com movimento forte circular simulando bater o funge na panela com a colher de pau.
- **`banana-pao-com-ginguba`**: Composto gestual: sinal de banana + sinal de ginguba (amendoim torrado mastigado junto aos dentes).
- **`bombo-com-ginguba`**: Composto gestual: sinal de bombó (mandioca descascada) + toque de ginguba nos dentes.
- **`fuba-de-milho`** / **`fuba-de-milho-branco`** / **`fuba-de-bombo`**: Variações de polvilhar fuba fina combinadas com o indicador do tipo de cereal ou raiz.
- **`cebola`**: Mãos em camadas esféricas seguidas de esfregar os olhos simulando lacrimejar com o ardor da cebola.
- **`pimento`**: Legume volumoso seguido de sinal junto à têmpora (possível menção à ardência).

### B. Empréstimos Datilológicos (Palavras Soletradas sem Sinal Icónico Próprio)
Nas aulas, os instrutores optaram por soletrar em alfabeto manual diversos termos alimentares e meses do ano:
- Alimentos: `mucua`, `goiaba`, `abacate`, `salada`, `vinagre`, `presunto`, `sandes`, `pizza`, `repolho`, `farinha-musseque`, `trigo`.
- Meses: `fevereiro`, `marco`, `abril`, `maio`, `julho`, `agosto`.

### C. Sistema Numérico (`numeros`)
- Todos os 27 numerais (1..20, 30, 40, 50, 60, 70, 80, 90) foram registados com confiança `média` para distinguir as configurações de 6..9 (polegar com dedos fletidos) e as dezenas em LGA face ao ASL ou LGP sob resolução de 360p.

### D. Alfabeto Manual (`abecedario`)
- **`letra-x`**: A postura mostrada na aula aproxima-se dos dedos cruzados de `R`; convém validar a orientação exata ou se existe ligeira flexão em gancho.
- Nota etnográfica: Na montagem original do canal Viva Surdo, a **`letra-g`** foi omitida na edição do vídeo entre `F` (62 s) e `H` (65 s).
