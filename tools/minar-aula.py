#!/usr/bin/env python3
"""Minerar as aulas de LGA do canal Viva surdo.

  python tools/minar-aula.py listar                  # catálogo do canal
  python tools/minar-aula.py baixar <id> <slug>      # vídeo -> fotogramas + folha das legendas
  python tools/minar-aula.py recortes <slug> <tempo.json>   # uma folha por palavra

Escreve tudo em `.mine/<slug>/` (fora do git). O vídeo é apagado depois de
extrair os fotogramas, porque o disco desta máquina tem pouco espaço livre.

As aulas trazem a palavra escrita em grande no rodapé do quadro, por isso a
folha das legendas é a linha de tempo: cada quadrado é um segundo, contado da
esquerda para a direita, linha a linha. Quem lê a folha escreve `tempo.json`
como `{"azul": [21, 24], "preto": [5, 8]}` e o passo `recortes` faz uma folha
de três fotogramas por palavra (início, meio, fim) — é o que serve para
desenhar a notação.

A resolução máxima servida pelo YouTube sem sessão é 540x360: dá para ler a
forma da mão e o trajeto, não para contar dedos em poses fechadas.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

CANAL = "https://www.youtube.com/@vivasurdo8579/videos"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINE = os.path.join(RAIZ, ".mine")
YTDLP = [sys.executable, "-m", "yt_dlp", "--js-runtimes", "node",
         "--remote-components", "ejs:github"]
COLUNAS = 7
LARGURA_LEGENDA = 420
LARGURA_QUADRO = 340


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg não encontrado (pip install imageio-ffmpeg)")


def fonte(tamanho):
    for caminho in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(caminho):
            return ImageFont.truetype(caminho, tamanho)
    return ImageFont.load_default()


def correr(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit("falhou: %s\n%s" % (" ".join(cmd), (r.stderr or r.stdout)[-800:]))
    return r.stdout


def aviso(texto):
    sys.stdout.reconfigure(encoding="utf-8")
    print(texto)


def listar(_args):
    dados = json.loads(correr(YTDLP + ["--flat-playlist", "-J", CANAL]))
    for e in dados.get("entries", []):
        aviso("%-14s %5ds  %s" % (e.get("id"), e.get("duration") or 0, e.get("title")))
    aviso("\ntotal: %d vídeos" % len(dados.get("entries", [])))


def folha_legendas(quadros, n, saida):
    """Faixa do rodapé de cada segundo, numerada, numa só imagem."""
    alturas = []
    recortes = []
    for i in range(n):
        origem = os.path.join(quadros, "q%03d.png" % (i + 1))
        if not os.path.exists(origem):
            continue
        im = Image.open(origem)
        faixa = im.crop((0, int(im.height * 0.76), im.width, im.height))
        faixa = faixa.resize((LARGURA_LEGENDA, int(faixa.height * LARGURA_LEGENDA / faixa.width)))
        recortes.append((i, faixa))
        alturas.append(faixa.height)
    linhas = math.ceil(len(recortes) / COLUNAS)
    altura = max(alturas) if alturas else 80
    folha = Image.new("RGB", (COLUNAS * LARGURA_LEGENDA, linhas * (altura + 26)), (16, 16, 16))
    caneta = ImageDraw.Draw(folha)
    tipo = fonte(22)
    for k, (seg, faixa) in enumerate(recortes):
        x = (k % COLUNAS) * LARGURA_LEGENDA
        y = (k // COLUNAS) * (altura + 26)
        folha.paste(faixa, (x, y + 22))
        caneta.text((x + 6, y + 1), "%ds" % seg, fill=(255, 220, 80), font=tipo)
    folha.save(saida)
    return folha.size


def baixar(id_video, slug):
    pasta = os.path.join(MINE, slug)
    os.makedirs(pasta, exist_ok=True)
    url = "https://www.youtube.com/watch?v=" + id_video
    aviso("a baixar " + url)
    correr(YTDLP + ["-f", "b[height<=360]/b", "--no-playlist", "-o",
                    os.path.join(pasta, "aula.%(ext)s"), url])
    video = os.path.join(pasta, "aula.mp4")
    if not os.path.exists(video):
        outros = [f for f in os.listdir(pasta) if f.startswith("aula.")]
        if not outros:
            sys.exit("sem vídeo descarregado")
        video = os.path.join(pasta, outros[0])

    saida = subprocess.run([ffmpeg(), "-hide_banner", "-i", video],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
    info = (saida.stderr or "") + (saida.stdout or "")
    dur = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", info)
    seg = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else 0
    res = re.search(r"(\d{3,4})x(\d{3,4})", info)
    aviso("duração %.0fs  resolução %s" % (seg, res.group(0) if res else "?"))

    quadros = os.path.join(pasta, "quadros")
    os.makedirs(quadros, exist_ok=True)
    correr([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", video,
            "-vf", "fps=1", os.path.join(quadros, "q%03d.png")])
    n = len([f for f in os.listdir(quadros) if f.endswith(".png")])

    folha = os.path.join(pasta, "legendas.png")
    dimensao = folha_legendas(quadros, n, folha)
    aviso("folha das legendas: %s  %dx%d  (%d segundos, %d por linha)"
          % (folha, dimensao[0], dimensao[1], n, COLUNAS))
    aviso("próximo passo: ler a folha e escrever %s" % os.path.join(pasta, "tempo.json"))
    if os.environ.get("MANTER_VIDEO") != "1":
        os.remove(video)
        aviso("vídeo apagado; ficam %d fotogramas em %s" % (n, quadros))


def folha_palavra(quadros, indices, saida, rotulo):
    """Fotogramas segundo a segundo (pelo menos 1 por segundo), recortados no tronco, com segundos e rótulo."""
    imagens = []
    for s in indices:
        origem = os.path.join(quadros, "q%03d.png" % (s + 1))
        if not os.path.exists(origem):
            continue
        im = Image.open(origem)
        recorte = im.crop((int(im.width * 0.14), 0, int(im.width * 0.86), int(im.height * 0.88)))
        recorte = recorte.resize((LARGURA_QUADRO, int(recorte.height * LARGURA_QUADRO / recorte.width)))
        imagens.append((s, recorte))
    if not imagens:
        return None
    cabecalho = 34
    colunas = min(len(imagens), 6)
    linhas = math.ceil(len(imagens) / colunas)
    altura = max(im.height for _, im in imagens)
    folha = Image.new("RGB", (colunas * LARGURA_QUADRO, linhas * (altura + 24) + cabecalho), (250, 250, 246))
    caneta = ImageDraw.Draw(folha)
    caneta.text((8, 8), "%s   segundos %s (%d fotogramas)" % (rotulo, ", ".join(str(s) for s, _ in imagens), len(imagens)),
                fill=(20, 40, 36), font=fonte(22))
    tag_fonte = fonte(16)
    for k, (s, im) in enumerate(imagens):
        col = k % colunas
        lin = k // colunas
        x = col * LARGURA_QUADRO
        y = cabecalho + lin * (altura + 24)
        folha.paste(im, (x, y + 20))
        caneta.text((x + 8, y + 2), "%ds" % s, fill=(50, 80, 70), font=tag_fonte)
    folha.save(saida)
    return folha.size


def recortes(slug, ficheiro_tempo):
    pasta = os.path.join(MINE, slug)
    quadros = os.path.join(pasta, "quadros")
    tempo = json.load(open(ficheiro_tempo, encoding="utf-8"))
    feitos = []
    for palavra, (inicio, fim) in tempo.items():
        indices = list(range(inicio, fim + 1))
        saida = os.path.join(pasta, "palavra-%s.png" % palavra)
        dimensao = folha_palavra(quadros, indices, saida, palavra)
        if dimensao is None:
            aviso("sem fotogramas para " + palavra)
            continue
        feitos.append(saida)
        aviso("%s: %s -> %s (%s)" % (palavra, indices, saida, dimensao))
    aviso("\n%d folhas por palavra em %s" % (len(feitos), pasta))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    modo = sys.argv[1]
    os.makedirs(MINE, exist_ok=True)
    if modo == "listar":
        listar(sys.argv[2:])
    elif modo == "baixar" and len(sys.argv) >= 4:
        baixar(sys.argv[2], sys.argv[3])
    elif modo == "recortes" and len(sys.argv) >= 4:
        recortes(sys.argv[2], sys.argv[3])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
