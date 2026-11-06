import os
import json
import math
import re
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINE = os.path.join(RAIZ, ".mine")
YTDLP = [sys.executable, "-m", "yt_dlp", "--js-runtimes", "node", "--remote-components", "ejs:github"]
FPS = 2.0  # 1 fotograma a cada 0.5s
LARGURA_QUADRO = 340

def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg não encontrado")

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

def baixar_e_extrair(id_video, slug):
    pasta = os.path.join(MINE, slug)
    os.makedirs(pasta, exist_ok=True)
    video = os.path.join(pasta, "aula.mp4")
    url = "https://www.youtube.com/watch?v=" + id_video
    print(f"A descarregar {url} para {video}...")
    correr(YTDLP + ["-f", "b[height<=360]/b", "--no-playlist", "-o", os.path.join(pasta, "aula.%(ext)s"), url])
    if not os.path.exists(video):
        outros = [f for f in os.listdir(pasta) if f.startswith("aula.")]
        if not outros:
            sys.exit("sem vídeo descarregado")
        video = os.path.join(pasta, outros[0])

    quadros = os.path.join(pasta, "quadros_2fps")
    os.makedirs(quadros, exist_ok=True)
    print(f"A extrair fotogramas a {FPS} fps (a cada 0.5s)...")
    correr([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", video,
            "-vf", f"fps={FPS}", os.path.join(quadros, "q%04d.png")])
    n = len([f for f in os.listdir(quadros) if f.endswith(".png")])
    print(f"Extraídos {n} fotogramas a {FPS} fps em {quadros}")
    return quadros

def gerar_folhas(slug, ficheiro_tempo, quadros):
    pasta = os.path.join(MINE, slug)
    tempo = json.load(open(ficheiro_tempo, encoding="utf-8"))
    tag_fonte = fonte(16)
    tipo_tit = fonte(22)
    cabecalho = 34

    for palavra, (inicio, fim) in tempo.items():
        # Timestamps a cada 0.5s
        timestamps = [round(inicio + i / FPS, 2) for i in range(int(round((fim - inicio) * FPS)) + 1)]
        imagens = []
        for t in timestamps:
            frame_idx = int(round(t * FPS)) + 1
            origem = os.path.join(quadros, f"q{frame_idx:04d}.png")
            if not os.path.exists(origem):
                continue
            im = Image.open(origem)
            recorte = im.crop((int(im.width * 0.14), 0, int(im.width * 0.86), int(im.height * 0.88)))
            recorte = recorte.resize((LARGURA_QUADRO, int(recorte.height * LARGURA_QUADRO / recorte.width)))
            imagens.append((t, recorte))

        if not imagens:
            print(f"Aviso: sem fotogramas para {palavra}")
            continue

        colunas = min(len(imagens), 6)
        linhas = math.ceil(len(imagens) / colunas)
        altura = max(im.height for _, im in imagens)
        folha = Image.new("RGB", (colunas * LARGURA_QUADRO, linhas * (altura + 24) + cabecalho), (250, 250, 246))
        caneta = ImageDraw.Draw(folha)
        
        rotulo_topo = f"{palavra}   segundos {inicio}..{fim} ({len(imagens)} fotogramas, 1 a cada 0.5s)"
        caneta.text((8, 8), rotulo_topo, fill=(20, 40, 36), font=tipo_tit)

        for k, (t, im) in enumerate(imagens):
            col = k % colunas
            lin = k // colunas
            x = col * LARGURA_QUADRO
            y = cabecalho + lin * (altura + 24)
            folha.paste(im, (x, y + 20))
            caneta.text((x + 8, y + 2), f"{t:.1f}s", fill=(50, 80, 70), font=tag_fonte)

        saida = os.path.join(pasta, f"palavra-{palavra}.png")
        folha.save(saida)
        print(f"Gerada folha: {saida} ({folha.size[0]}x{folha.size[1]}, {len(imagens)} fotogramas)")

if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else "saudacao"
    vid = sys.argv[2] if len(sys.argv) > 2 else "XyGt-yaHJkA"
    quadros = baixar_e_extrair(vid, slug)
    tempo_path = os.path.join(MINE, slug, "tempo.json")
    gerar_folhas(slug, tempo_path, quadros)
    print("Concluído!")
