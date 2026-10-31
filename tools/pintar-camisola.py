"""Repinta a folha de textura da roupa: t-shirt verde-azulada com vivo creme.

Parte do diffuse original do female_casualsuit01 (as UV coincidem de certeza):
  · tira o logótipo MakeHuman da costas (cópia de tecido com máscara suave);
  · troca o azul da camisa por verde-azulado, guardando a sombra e o grão;
  · troca o laranja vivo por creme;
  · deixa o ganga como está.

Correr:
  python tools/pintar-camisola.py [--preview]
"""

import os, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIGEM = os.path.join(
    os.environ.get("APPDATA", ""), "Blender Foundation", "Blender", "5.2",
    "extensions", ".user", "user_default", "mpfb", "data", "clothes",
    "female_casualsuit01", "female_casualsuit01_diffuse.png")
DESTINO = os.path.join(AQUI, "assets", "camisola-verde.png")
PREVIEW = os.path.join(os.path.expanduser("~"), "glb-lab", "shots", "camisola-preview.png")

TECIDO = np.array([0.11, 0.42, 0.36])      # verde-azulado profundo
VIVO = np.array([0.93, 0.89, 0.78])        # creme
LOGO = (1624, 474, 170)                    # centro x, centro y, raio (com folga)
ORIGEM_LOGO = (-360, 0)                    # desvio para copiar tecido limpo


def lum(a):
    return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722


def main():
    im = Image.open(ORIGEM).convert("RGB")
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w, _ = a.shape
    print("folha", w, h)

    yy, xx = np.mgrid[0:h, 0:w]

    # --- tirar o logótipo (antes de medir cores, senão volta a ser pintado) --
    cx, cy, raio = LOGO
    dx, dy = ORIGEM_LOGO
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    fonte_y = np.clip(yy + dy, 0, h - 1)
    fonte_x = np.clip(xx + dx, 0, w - 1)
    copia = a[fonte_y, fonte_x]
    anel = (d > raio - 24) & (d < raio + 70)
    med_alvo = float(np.median(lum(a)[anel]))
    med_copia = float(np.median(lum(copia)[d < raio - 30]))
    copia = np.clip(copia * (med_alvo / max(med_copia, 1e-4)), 0, 1)
    k = np.clip((raio - d) / 26.0, 0, 1)[..., None]      # máscara suave na borda
    a = a * (1 - k) + copia * k
    resto = float(lum(a)[d < raio - 30].max())
    print("logótipo coberto:", int((d < raio).sum()), "px; luminância máx no miolo", round(resto, 3))
    assert resto < 0.45, "o logótipo ainda está lá"

    # --- zona da camisa (painéis de cima + mangas à direita) --------------
    zona = (yy < 0.415 * h) | ((xx > 0.72 * w) & (yy > 0.50 * h) & (yy < 0.85 * h))
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    azul = zona & (b > r * 1.15) & (b > g * 1.03) & (b > 0.18)
    laranja = zona & (r > 0.55) & (g > 0.18) & (g < 0.62) & (b < 0.38) & (r > b * 1.9)

    # --- pintar ------------------------------------------------------------
    l = lum(a)
    mediana = float(np.median(l[azul]))
    razao = np.clip(l / max(mediana, 1e-4), 0.45, 1.55)[..., None]
    novo_tecido = np.clip(TECIDO[None, None, :] * razao, 0, 1)

    l_aran = lum(a)
    med_aran = float(np.median(l_aran[laranja])) if laranja.any() else 0.5
    razao_o = np.clip(l_aran / max(med_aran, 1e-4), 0.55, 1.35)[..., None]
    novo_vivo = np.clip(VIVO[None, None, :] * razao_o, 0, 1)

    saida = a.copy()
    saida[azul] = novo_tecido[azul]
    saida[laranja] = novo_vivo[laranja]
    print("tecido", int(azul.sum()), "px; vivo", int(laranja.sum()), "px")

    res = Image.fromarray((np.clip(saida, 0, 1) * 255).astype(np.uint8))
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    res.save(DESTINO)
    print("guardado", DESTINO, res.size)

    if "--preview" in sys.argv:
        palco = Image.new("RGB", (1024, 1024), (246, 249, 241))
        palco.paste(res.resize((1024, 1024)), (0, 0))
        palco.save(PREVIEW)
        print("preview", PREVIEW)


main()
