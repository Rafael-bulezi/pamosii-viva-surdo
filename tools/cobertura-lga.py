#!/usr/bin/env python3
"""Cruza os inventários das aulas do Viva surdo com o glossário da app.

  python tools/cobertura-lga.py                       # usa tools/fonte/aulas-lga/ daqui
  python tools/cobertura-lga.py --aulas <pasta>       # usa os JSON de outra workspace

Diz quantas palavras do glossário passam a ter fonte LGA verdadeira, com que
confiança, e o que as aulas ensinam e o glossário ainda não tem.
"""
import glob
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "app", "dados.js")


def sem_acentos(t):
    t = unicodedata.normalize("NFKD", t)
    return "".join(c for c in t if not unicodedata.combining(c)).lower().strip()


def limpar(t):
    t = sem_acentos(t)
    t = re.sub(r"[?!.:;()\"]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def glossario():
    texto = open(DADOS, encoding="utf-8").read()
    texto += open(os.path.join(RAIZ, "app", "referencias.js"), encoding="utf-8").read()
    palavras = {}
    for m in re.finditer(r'tema: "([a-zà-úA-ZÀ-Ú ]+)", termos: \[(.*?)\]', texto, re.S):
        tema = m.group(1)
        for termo in re.findall(r'"([^"]+)"', m.group(2)):
            palavras.setdefault(limpar(termo), (termo, tema))
    for m in re.finditer(r"tema: '([^']+)', termos: \[(.*?)\]", texto, re.S):
        tema = m.group(1)
        for termo in re.findall(r"'([^']+)'", m.group(2)):
            palavras.setdefault(limpar(termo), (termo, tema))
    return palavras


def inventario(pasta):
    entradas = {}
    for ficheiro in sorted(glob.glob(os.path.join(pasta, "*.json"))):
        dados = json.load(open(ficheiro, encoding="utf-8"))
        for e in dados.get("palavras", []):
            chave = limpar(e.get("palavra", ""))
            if not chave:
                continue
            entrada = entradas.setdefault(chave, [])
            entrada.append({"aula": dados.get("aula"), "confianca": e.get("confianca"),
                            "segundos": e.get("segundos"), "folha": e.get("folha")})
    return entradas


def melhor(lista):
    ordem = {"alta": 3, "média": 2, "media": 2, "baixa": 1}
    return max(lista, key=lambda e: ordem.get(e["confianca"], 0))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    pasta = os.path.join(RAIZ, "tools", "fonte", "aulas-lga")
    if "--aulas" in sys.argv:
        pasta = sys.argv[sys.argv.index("--aulas") + 1]
    glossa = glossario()
    aulas = inventario(pasta)
    print("glossário: %d palavras   inventário das aulas: %d palavras   (%s)"
          % (len(glossa), len(aulas), pasta))

    cobertos, por_conf = [], {"alta": 0, "média": 0, "baixa": 0, "?": 0}
    for chave, (termo, tema) in sorted(glossa.items(), key=lambda kv: kv[1][1]):
        if chave in aulas:
            e = melhor(aulas[chave])
            conf = e["confianca"] or "?"
            por_conf[conf] = por_conf.get(conf, 0) + 1
            cobertos.append((tema, termo, conf, e["aula"], e["segundos"]))
    print("\ncom fonte LGA de vídeo: %d de %d palavras do glossário" % (len(cobertos), len(glossa)))
    print("confiança:", {k: v for k, v in por_conf.items() if v})

    temas = {}
    for tema, termo, conf, aula, seg in cobertos:
        temas.setdefault(tema, []).append("%s (%s)" % (termo, conf))
    for tema in sorted(temas):
        print("\n%s — %d\n  %s" % (tema, len(temas[tema]), ", ".join(sorted(temas[tema]))))

    novos = sorted(set(aulas) - set(glossa))
    print("\n%d palavras nas aulas que o glossário ainda não tem:" % len(novos))
    linha = ", ".join(novos)
    for i in range(0, len(linha), 92):
        print("  " + linha[i:i + 92])


if __name__ == "__main__":
    main()
