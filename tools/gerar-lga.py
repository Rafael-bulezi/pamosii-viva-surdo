#!/usr/bin/env python3
"""Gera app/lga.js a partir do inventário das aulas do Viva surdo.

  python tools/gerar-lga.py

Lê tools/fonte/aulas-lga/*.json (o que o Antigravity minerou, com revisão
humana pendente) e escreve um único ficheiro que a app carrega: a chave é a
palavra normalizada, o valor diz de que aula, em que segundos, com que
confiança e o que se vê no quadro.

A letra e o algarismo são normalizados para a palavra do glossário (1 -> um),
para a evidência cair no cartão certo. Entradas entre parênteses rectos (o
aplauso de fecho) não são vocabulário e ficam de fora.
"""
import glob
import json
import os
import re
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "tools", "fonte", "aulas-lga")
SAIDA = os.path.join(RAIZ, "app", "lga.js")

NUMERAIS = {
    "1": "um", "2": "dois", "3": "três", "4": "quatro", "5": "cinco",
    "6": "seis", "7": "sete", "8": "oito", "9": "nove", "10": "dez",
    "11": "onze", "12": "doze", "13": "treze", "14": "catorze", "15": "quinze",
    "16": "dezasseis", "17": "dezassete", "18": "dezoito", "19": "dezanove",
    "20": "vinte", "30": "trinta", "40": "quarenta", "50": "cinquenta",
    "60": "sessenta", "70": "setenta", "80": "oitenta", "90": "noventa",
}
ORDEM = {"alta": 3, "média": 2, "media": 2, "baixa": 1}


def chave(t):
    t = unicodedata.normalize("NFKD", str(t))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower().strip()
    t = re.sub(r"[?!.:;()\"]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def ordem_aula(nome):
    m = re.search(r"Aula\s+(\d+)", nome or "")
    return (int(m.group(1)), nome or "") if m else (900, nome or "")


def video_id(url):
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", url or "")
    return m.group(1) if m else ""


def main():
    entradas = {}
    aulas = {}
    saltadas = []
    for ficheiro in sorted(glob.glob(os.path.join(ORIGEM, "*.json"))):
        dados = json.load(open(ficheiro, encoding="utf-8"))
        aula = dados.get("aula", "")
        vid = video_id(dados.get("video", ""))
        if not vid:
            raise SystemExit("aula sem id de vídeo: " + ficheiro)
        aulas[aula] = vid
        for p in dados.get("palavras", []):
            palavra = str(p.get("palavra", "")).strip()
            if not palavra:
                continue
            if palavra.startswith("["):
                saltadas.append(aula + " :: " + palavra)
                continue
            k = NUMERAIS.get(palavra, chave(palavra))
            entrada = {
                "palavra": palavra,
                "chave": k,
                "aula": aula,
                "video": vid,
                "segundos": p.get("segundos") or [],
                "confianca": p.get("confianca") or "",
                "veSe": p.get("ve-se") or "",
                "forma": p.get("forma-da-mão") or p.get("forma-da-mao") or "",
                "lugar": p.get("lugar") or "",
                "movimento": p.get("movimento") or "",
                "duvida": p.get("duvida") or "",
            }
            antes = entradas.get(k)
            if (not antes or ORDEM.get(entrada["confianca"], 0) > ORDEM.get(antes["confianca"], 0)
                    or (ORDEM.get(entrada["confianca"], 0) == ORDEM.get(antes["confianca"], 0)
                        and ordem_aula(aula) < ordem_aula(antes["aula"]))):
                entradas[k] = entrada

    lista = sorted(entradas.values(), key=lambda e: (ordem_aula(e["aula"]), e["segundos"][:1], e["palavra"].lower()))
    meta = {
        "nome": "Viva surdo",
        "canal": "https://www.youtube.com/@vivasurdo8579/videos",
        "aulas": len(aulas),
        "entradas": len(lista),
        "saltadas": len(saltadas),
    }
    corpo = json.dumps({e["chave"]: e for e in lista}, ensure_ascii=False, indent=1)
    js = """/* GERADO POR tools/gerar-lga.py — não editar à mão.
   ----------------------------------------------------------------------------
   FONTE_LGA — o que as aulas de LGA do canal Viva surdo mostram, palavra a
   palavra: aula, segundo, confiança e o que se vê no quadro. As descrições são
   leitura de fotogramas a 540x360, por revisar por sinalizadores surdos. Esta
   lista diz «a aula mostra isto»; não diz que a nossa pose 3D coincide.
   ---------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  const FONTE_LGA = %s;

  const LGA_META = %s;

  global.FONTE_LGA = FONTE_LGA;
  global.LGA_META = LGA_META;
})(window);
""" % (corpo, json.dumps(meta, ensure_ascii=False, indent=2))
    open(SAIDA, "w", encoding="utf-8", newline="\n").write(js)
    print("app/lga.js: %d palavras de %d aulas (%d entradas de fecho saltadas)"
          % (len(lista), len(aulas), len(saltadas)))


if __name__ == "__main__":
    main()
