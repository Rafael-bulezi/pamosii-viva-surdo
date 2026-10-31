#!/usr/bin/env python3
"""Gera app/referencias.js a partir do mapa de correspondências IS.

  python tools/mapear-is.py --escrever
  python tools/gerar-referencias.py

O ficheiro gerado é a única fonte das referências no site: o dicionário mostra
a ligação à entrada da Sématos e o glossa inglês, e nunca diz que um sinal está
validado. Editar app/referencias.js à mão é perder o trabalho na geração
seguinte — mexer em tools/mapear-is.py.
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, "fonte", "is-correspondencias.json")
COMPARADO = os.path.join(AQUI, "fonte", "is-comparado.json")
SAIDA = os.path.join(AQUI, "..", "app", "referencias.js")

CABECALHO = """/* ============================================================================
   REFERENCIAS_IS — o que o léxico International Sign documenta, palavra a palavra.
   ----------------------------------------------------------------------------
   GERADO POR tools/gerar-referencias.py a partir de tools/mapear-is.py; não
   editar à mão. Lista de 439 entradas IS: tools/fonte/sematos-isl-slugs.txt,
   colhida dos sitemaps públicos da Sématos em 2026-10-31.
   Uma referência aqui diz «o International Sign tem um sinal para esta ideia,
   visto aqui»; não diz que a nossa pose 3D coincide com ele, e não diz que a
   comunidade surda validou seja o que for.
   ============================================================================ */
(function (global) {
  'use strict';
"""
RODAPE = """
  global.REFERENCIAS_IS = REFERENCIAS_IS;
  global.IS_TEMAS = IS_TEMAS;
  global.IS_FONTE = IS_FONTE;
})(window);
"""


def js(v):
    return json.dumps(v, ensure_ascii=False)


def main():
    mapa = json.load(open(ENTRADA, encoding="utf-8"))
    comparado = {}
    if os.path.exists(COMPARADO):
        comparado = {k: v for k, v in json.load(open(COMPARADO, encoding="utf-8")).items()
                     if not k.startswith("_")}
    novas = {}
    for pt, r in sorted(mapa.items()):
        if r.get("tema"):
            novas.setdefault(r["tema"], []).append(pt)

    partes = [CABECALHO, "\n  const REFERENCIAS_IS = {\n"]
    for pt, r in sorted(mapa.items()):
        campos = ["glossa: " + js(r["glossa"]), "url: " + js(r["url"]), "slug: " + js(r["slug"])]
        if r.get("tema"):
            campos.append("tema: " + js(r["tema"]))
        variantes = r.get("variantes") or []
        if len(variantes) > 1:
            campos.append("variantes: [" + ", ".join(js(v) for v in variantes) + "]")
        if pt in comparado:
            campos.append("comparado: " + js(comparado[pt]["veredicto"]))
        partes.append("    %s: { %s },\n" % (js(pt), ", ".join(campos)))
    partes.append("  };\n\n  /* temas que só existem aqui porque o léxico IS os documenta */\n")
    partes.append("  const IS_TEMAS = [\n")
    for tema in sorted(novas):
        partes.append("    { tema: %s, termos: [%s] },\n" % (
            js(tema), ", ".join(js(w) for w in sorted(novas[tema]))))
    partes.append("  ];\n")
    total_is = sum(1 for linha in open(os.path.join(AQUI, "fonte", "sematos-isl-slugs.txt"), encoding="utf-8") if linha.strip())
    partes.append("\n  /* o número que aparece no site vem da lista colhida, não da memória */\n")
    partes.append("  const IS_FONTE = { nome: %s, total: %d, colhido: %s };\n" % (
        js("Sématos"), total_is, js("2026-10-31")))
    partes.append(RODAPE)

    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write("".join(partes))
    print("%d referências · %d comparadas com o vídeo · %d temas novos · %d palavras novas" % (
        len(mapa), len(comparado), len(novas), sum(len(v) for v in novas.values())))
    print(os.path.relpath(SAIDA, os.path.join(AQUI, "..")).replace("\\", "/"))


if __name__ == "__main__":
    main()
