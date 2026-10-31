#!/usr/bin/env python3
"""Tira fotogramas dos vídeos International Sign da Sématos para comparar.

  python tools/comparar-is.py "bom dia" "sim" "não" "escola"

Para cada palavra com referência em app/referencias.js: descarrega o mp4 da
entrada, amostra fotogramas, e junta tudo numa folha com legendas em
~/glb-lab/shots/. A folha serve para uma pessoa (ou este agente, com visão)
julgar se a nossa notação `forma local movimento` pertence à mesma família do
sinal documentado. Os vídeos ficam no laboratório local e não são redistribuídos.
"""
import io
import json
import os
import re
import sys
import urllib.request

import cv2
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "..")
LAB = os.path.join(os.path.expanduser("~"), "glb-lab")
VIDEOS = os.path.join(LAB, "is")
FOLHAS = os.path.join(LAB, "shots")
CORRESPONDENCIAS = os.path.join(AQUI, "fonte", "is-correspondencias.json")
ALTO = 260
AMOSTRAS = (0.12, 0.38, 0.62, 0.86)


def ler_referencias():
    """O mapa é o mesmo que gera app/referencias.js — não tornamos a parsear JS."""
    return json.load(open(CORRESPONDENCIAS, encoding="utf-8"))


def url_video(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})) as r:
        html = r.read().decode("utf-8", "ignore")
    m = re.search(r'"contentUrl":\s*"(https://[^"]+\.mp4)"', html)
    return m.group(1) if m else None


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 10000:
        return
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})) as r:
        dados = r.read()
    with open(destino, "wb") as f:
        f.write(dados)


def fotogramas(caminho, n=4):
    cap = cv2.VideoCapture(caminho)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    out = []
    for frac in AMOSTRAS[:n]:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * frac))
        ok, frame = cap.read()
        if ok:
            out.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    cap.release()
    return out


def folha(palavra, ref, imagens):
    if not imagens:
        return None
    altura = ALTO
    larguras = [int(im.width * altura / im.height) for im in imagens]
    banda = 26
    folha_img = Image.new("RGB", (sum(larguras), altura + banda), "white")
    d = ImageDraw.Draw(folha_img)
    x = 0
    for im, w in zip(imagens, larguras):
        folha_img.paste(im.resize((w, altura), Image.LANCZOS), (x, 0))
        x += w
    legenda = "%s  ·  IS: %s  ·  %s" % (palavra, ref["glossa"], ref["url"].split("/")[-1])
    d.rectangle([0, altura, folha_img.width, altura + banda], fill="#111814")
    d.text((8, altura + 7), legenda, fill="white")
    os.makedirs(FOLHAS, exist_ok=True)
    destino = os.path.join(FOLHAS, "is-" + re.sub(r"[^a-z0-9]+", "-", palavra.lower()).strip("-") + ".png")
    folha_img.save(destino)
    return destino


def main(palavras):
    refs = ler_referencias()
    for palavra in palavras:
        ref = refs.get(palavra)
        if not ref:
            print("%-16s sem referência IS" % palavra)
            continue
        try:
            vurl = url_video(ref["url"])
            if not vurl:
                print("%-16s sem mp4 na página (%s)" % (palavra, ref["url"]))
                continue
            mp4 = os.path.join(VIDEOS, ref["slug"] + ".mp4")
            baixar(vurl, mp4)
            imgs = fotogramas(mp4)
            destino = folha(palavra, ref, imgs)
            print("%-16s %-18s %s  (%d fotogramas, %d KB)" % (
                palavra, ref["glossa"], destino, len(imgs), os.path.getsize(mp4) // 1024))
        except Exception as e:
            print("%-16s FALHOU: %s" % (palavra, e))


if __name__ == "__main__":
    main(sys.argv[1:] or ["bom dia"])
