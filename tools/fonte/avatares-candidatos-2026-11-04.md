# Candidatos a apresentador 3D — lista curta (2026-11-04)

Contexto: o apresentador actual (MPFB, `app/assets/agatha-mpfb-rig.glb`, 13,8 MB,
55 articulações, 10 malhas) já leva o palco em vs117, mas o detalhe é da classe do
activo: costuras gravadas na camisola, afro facetado, mãos simples e cara rígida.
Esta lista prepara a decisão de compra; nada aqui foi comprado nem integrado.

Preços e especificações vistos nas páginas oficiais a 4 Nov 2026. Preços de
promoção mudam sem aviso — confirmar no checkout antes de pagar.

## Lista

| candidato | preço | licença | dedos | formato | encaixe no nosso pipeline |
|---|---|---|---|---|---|
| **Blender Studio — Rain v3** | 0 € | CC-BY (atribuição) | cadeias de dedos via CloudRig (camadas Fingers FK/IK) | .blend com rig; export GLB no Blender | **Melhor teste grátis.** Rig controlável, exporta para GLB; precisa de converter e mapear nomes de ossos |
| **Blender Studio — Ellie** | 0 € | CC-BY | idem (página mostra camadas Fingers FK/IK) | .blend | idem; feminino |
| **Blender Studio — Storm** | 0 € | CC-BY | idem | .blend | idem |
| **VRoid — AvatarSample_A** | 0 € | CC0 | **30 ossos de dedos, 103 articulações (verificado por parsing do ficheiro); 15,1 MB** | VRM (glTF + extensões) | Precisa de conversão VRM→GLB (add-on no Blender); estilo anime, não realista |
| **Adobe Mixamo** | 0 € (conta Adobe) | royalty-free Adobe | **40 ossos de dedos, 49 articulações** | FBX | Converte para GLB no Blender; pouca variedade de roupa; estilo menos estilizado |
| **ActorCore** (Reallusion) | ~30 $ (visto 4 Nov) | licença Reallusion; ler cláusula de distribuição em massa | rig com dedos (confirmar no ficheiro) | FBX | Conversão normal; verificar cláusula antes de publicar |
| **Unity Asset Store — Cute Kids** | 19,99 $ | Unity Single Entity | **não verificado** | pacote Unity | Só serve se os dedos existirem e o rig exportar; risco alto |
| **Reallusion CC5** | 179,40 $ (promoção) | Reallusion; cláusula de distribuição em massa | rig completo com dedos | CC/iClone → FBX/GLB | Qualidade alta, mas o custo e a licença são os mais pesados |
| **Reallusion HD Caricature Mixer** | 140,40 $ (promoção) | idem | idem | idem | Estilo caricatura; só faz sentido depois de comprar o CC5 |

Fora de lista: **Ready Player Me** fechou a 31 Jan 2026 — não há produto para
comprar. **Daz 3D** fica de fora pela licença de uso comercial.

## Armadilhas de licença

- Nenhum destes permite redistribuir o ficheiro do activo em bruto. O GLB pode ir
  no site como parte da aplicação, mas o repositório público e o Pages não podem
  servir o modelo como download separado.
- CC-BY (Blender Studio) obriga a crédito visível. Se for escolhido, entra uma
  linha de créditos no rodapé ou numa página «sobre».
- Unity Single Entity limita o uso a uma entidade; não cobre um produto que
  outras pessoas vão operar.
- Reallusion tem cláusula de distribuição em massa; serve para uma app própria,
  não para vender o modelo dentro de outro produto sem licença extra.
- Mixamo é royalty-free para uso no projecto, mas continua a ser um serviço
  Adobe — exportar cedo e guardar o FBX localmente.

## Recomendação (ordem de teste, sem gastar)

1. **Rain v3 (0 €)** — testar primeiro: exportar GLB, mapear os nomes de ossos
   do nosso `ESQUELETO`, correr as 191 poses e a folha de quatro sinais. Se a
   cara e as mãos aguentarem, resolve o problema sem comprar nada.
2. **AvatarSample_A (0 €)** — segunda opção gratuita com a prova de dedos mais
   forte (30 ossos contados); o estilo anime é a limitação.
3. **ActorCore (~30 $)** — primeira compra, se as duas gratuitas falharem na
   estética. Barata face ao CC5.
4. **CC5 (179,40 $)** — só se a qualidade tiver de subir de classe e a licença
   de distribuição em massa não for problema.

O critério de aceitação é o mesmo para todos: 55+ articulações com dedos
independentes, exporta GLB, e as poses dos 191 sinais continuam a fechar sem
clipping nas mãos. Uma folha de quatro sinais (`sempre`, `grande`, `nunca`,
`casa`) decide em minutos.
