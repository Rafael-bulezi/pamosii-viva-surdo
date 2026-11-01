# Existe animação de língua gestual que possamos reaproveitar? — 2026-11-01

Pergunta: antes de desenhar 191 sinais à mão, confirmar se existe **dados abertos de movimento**
de língua gestual que possam ser retargetados para o rig MPFB (`agatha-mpfb-rig.glb`).
Método: procura web dirigida (7 candidatos), leitura das licenças e formatos, e verificação local
com Blender 5.2.3 + 5 clips reais.

## Veredicto em uma linha

**Não existe dados de LGA. O único corpus CC0 grande é ASL e vale como *estilo de movimento*,
não como conteúdo dos sinais — e serviu imediatamente para provar que a nossa amplitude está
10–24× abaixo do real.** Não se constrói pipeline de retargeting. Segue-se A (capacidades do
renderer) e B (autoria por sinal).

## Candidatos avaliados

| Fonte | Línguas | Forma | Licença | Serve? |
|---|---|---|---|---|
| **StudioGalt SLMocapArchive** | ASL, BANZL | 2 586 sinais, FBX + rig Mixamo/UE, captura Xsens Link + luvas StretchSense a 240 fps | **CC0** | Parcial: estilo e calibração. Conteúdo ASL ≠ LGA |
| SignAvatars (ECCV 2024) | ASL, GSL… | 8,34 M frames SMPL-X | Acesso por formulário, **não comercial** | Não: licença e corpo |
| PE2LGP (LGP) | Português europeu | HamNoSys por keyframe, avatar próprio | Ferramenta “released”, dados não publicados | Não: sem dados |
| JASigning / SiGML (UEA) | HamNoSys genérico | Motor de animação + avatares Anna/Marc | Research | Não: sem os nossos sinais |
| MMS-Player (DFKI) | DGS | Formato MMS → animação Blender, avatar Gloria | **GPL-3** | Não: licença + dicionário em cloud |
| DictaSign / DGS Corpus / PJM | DE, EL, FR, IT, NL, PL | Anotação linguística + vídeo | Research | Não: sem LGA |
| INEE (Angola) | **LGA** | Dicionário impresso, 2 volumes | — | Sem digital, sem movimento |

Notas de licença que decidem sozinhas: SignAvatars é não comercial e em malha SMPL-X (não
esquelética); MMS-Player é GPL-3, incompatível com o nosso `app/` publicado; JASigning e
DictaSign são de investigação. Só o StudioGalt é CC0 sem condições.

## O que verifiquei localmente (não assumido)

- Descarreguei um clip do StudioGalt e importei-o em Blender 5.2.3 sem interface.
- Resultado: armature `Galtis_Rig`, **53 ossos**, nomes `mixamorig1:*` com cadeias completas de
  mão (`LeftHandIndex1..3`, `Middle`, `Ring`, `Pinky`, `Thumb1..3`) e ação de 246 frames a 60 fps.
- Formato: FBX 7400, variantes `Mesh`, `No Mesh Full`, `No Mesh Mini`, `No Mesh Mixamo`,
  `No Mesh UE Mannequin`. O `Mixamo` mapeia 1:1 para as cadeias do nosso rig.
- Ou seja: **retarget é tecnicamente viável** — o que falha é o conteúdo, não o formato.

## Cobertura do nosso vocabulário

- 2 586 gravações no total, mas **2 555 estão em palavras começadas por A–D** (A 419, B 852,
  C 894, D 390); E, F, H, M, N, O, P, T, V, W, Y somam 31. É um arquivo em construção, não um léxico.
- Cruzando as nossas 191 palavras com um glossário inglês: **72 (38%)** têm entrada com o mesmo
  nome. Número superior ao real, porque *mesma palavra inglesa ≠ mesmo sinal em LGA*.
- Não há qualquer entrada em português, nem LGP, nem LGA.

## O achado que muda o plano

Medi movimento real (punho direito, 5 clips, 1 sinalizador, ASL) e comparei com o que o nosso
renderer produz hoje (191 sinais, `tools/fonte/auditoria-render.json`):

| Métrica | Real (n=5) | Nosso avatar (n=191) | Razão |
|---|---|---|---|
| Deslocamento do punho | 120–300 cm por clip | mediana 5,7 cm; máx 13,4 cm | **10–24×** |
| Passo por frame (60 fps) | mediana 0,35–0,72 cm; p90 1,2–2,7 cm | — | — |
| Rotação acumulada da palma | 360–714° por clip | mediana **0°**; p90 5°; máx 13,6° | **ordens de grandeza** |
| Duração | 2,9–7,1 s | ~1,5 s | — |

O clip tem sempre **um** frame fora de série (salto de 59–67 cm), um artefacto de importação;
foi excluído (`step < 8 cm`), e o resto é coerente.

Isto confirma, com dados externos e não com opinião, o defeito C da auditoria:
`ESC_MOV = 0.37` em `app/sinal3d.js` não é conservador, é quase estático. E confirma o defeito A:
a palma quase não roda porque a orientação vem do local (`palma: L.palma`), não do sinal.

## Consequências para o plano aprovado

1. **C está fechado**: sem dados de LGA, sem retarget. O corpus fica como referência de estilo.
2. **A passa a ter números-alvo**: amplitude do punho na ordem de dezenas de cm por sinal e
   rotação de palma na ordem de 100°+ por sinal, em vez de valores escolhidos a olho.
3. **B continua obrigatório** para a correção linguística: nenhum corpus ASL pode dizer qual é o
   sinal de «bater» em LGA.

## O que faria mudar o veredicto

- Um corpus de movimento em LGP ou LGA (não existe hoje; o INEE só publica papel).
- A recolha própria: o mesmo protocolo do StudioGalt com um sinalizador de LGA — fora do âmbito
  deste pacote e dependente de validação Surda.

## Fontes

- StudioGalt SLMocapArchive — https://github.com/StudioGalt/Sign-Language-Mocap-Archive (CC0)
- SignAvatars — https://signavatars.github.io/ ; https://github.com/ZhengdiYu/SignAvatars
- PE2LGP — https://aclanthology.org/2020.signlang-1.6/
- JASigning — https://vh.cmp.uea.ac.uk/index.php/JASigning_Demos
- MMS-Player — https://github.com/DFKI-SignLanguage/MMS-Player
- Inquérito a notação → pose — https://arxiv.org/html/2211.13613v3
