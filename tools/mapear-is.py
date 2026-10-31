#!/usr/bin/env python3
"""Mapeia o glossário português para o léxico International Sign da Sématos.

A lista de 439 entradas IS vive em tools/fonte/sematos-isl-slugs.txt (colhida
dos sitemaps públicos em 2026-10-31). Este script é a única fonte das
correspondências: o que não estiver aqui não tem referência no site.

  python tools/mapear-is.py            # relatório no terminal
  python tools/mapear-is.py --escrever # grava tools/fonte/is-correspondencias.json

Porque é um script e não uma edição à mão no `app/dados.js`: as correspondências
têm de poder ser relidas e contestadas, e o `app/referencias.js` gerado tem de
sair do mesmo sítio que o relatório.
"""
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SLUGS = os.path.join(AQUI, "fonte", "sematos-isl-slugs.txt")
SAIDA = os.path.join(AQUI, "fonte", "is-correspondencias.json")
BASE = "https://www.sematos.eu/en/isl/words/"

# palavra do glossário -> slug IS. Só equivalências reais: sem IS, fica de fora
# e aparece no relatório como SEM REFERÊNCIA (não se inventa parentesco).
CORRESPONDENCIAS = {
    # --- saudações e cortesia ---
    "bom dia": "good-morning",
    "boa tarde": "good-afternoon",
    "boa noite": "good-night",
    "sim": "yes",
    "não": "no",
    "desculpa": "i-am-sorry",
    "mau": "bad",
    # --- diálogo e língua ---
    "conversa": "talk",
    "perguntar": "ask-for",
    "responder": "answer",
    "falar em lga": "sign-language",
    # --- escola ---
    "escola": "school",
    "professor": "teacher",
    "estudar": "learn",
    "ler": "read",
    "escrever": "write",
    "computador": "computer",
    # --- cores ---
    "vermelho": "red",
    "azul": "blue",
    "verde": "green",
    "amarelo": "yellow",
    "preto": "black",
    "branco": "white",
    "laranja": "orange",
    "castanho": "brown",
    "cores": "color",
    # --- verbos ---
    "comer": "eat",
    "ver": "see",
    "trabalhar": "work",
    "gostar": "like",
    "querer": "want",
    "ter": "have",
    "dar": "give",
    "ajudar": "help",
    "ir": "go",
    "vir": "come",
    "esperar": "wait",
    "poder": "be-able",
    "dever": "must",
    "comprar": "buy",
    "vender": "sell",
    # --- adjetivos e estados ---
    "pequeno": "little",
    "novo": "new",
    "velho": "old",
    "rápido": "fast",
    "lento": "slow",
    "quente": "hot",
    "frio": "cold",
    "feliz": "happy",
    "triste": "sad",
    "cansado": "tired",
    "saudável": "healthy",
    "doente": "illness",
    # --- casa e família ---
    "casa": "home",
    "casa de banho": "toilet",
    "família": "family",
    "mãe": "mother",
    "pai": "father",
    "filho": "child",
    "amigo": "friend",
    # --- tempo ---
    "hoje": "today",
    "amanhã": "tomorrow",
    "ontem": "yesterday",
    "agora": "now",
    "depois": "later",
    "semana": "week",
    "mês": "month",
    "ano": "year",
    "dia": "day",
    "sempre": "always",
    "nunca": "never",
    "devagar": "slow",
    # --- dia a dia ---
    "mercado": "store",
    "autocarro": "bus",
    "dinheiro": "money",
    "telefone": "telephone",
    "hospital": "hospital",
    "médico": "doctor",
    "muito": "many",
    "pouco": "little",
    "água": "water",
    "café": "coffee",
    "leite": "milk",
}

# entradas novas: o léxico IS documenta coisas que o nosso glossário não tinha.
# (português, slug, tema) — todo o slug foi verificado contra a lista de 439;
# «zero», «setenta» e «chamar-se» ficaram de fora porque a Sématos não os tem.
ADICIONAR = [
    ("um", "one", "Números"),
    ("dois", "two", "Números"),
    ("três", "three", "Números"),
    ("quatro", "four", "Números"),
    ("cinco", "five", "Números"),
    ("seis", "six", "Números"),
    ("sete", "seven", "Números"),
    ("oito", "eight", "Números"),
    ("nove", "nine", "Números"),
    ("dez", "ten", "Números"),
    ("onze", "eleven", "Números"),
    ("doze", "twelve", "Números"),
    ("treze", "thirteen", "Números"),
    ("catorze", "fourteen", "Números"),
    ("quinze", "fifteen", "Números"),
    ("dezasseis", "sixteen", "Números"),
    ("dezassete", "seventeen", "Números"),
    ("dezoito", "eighteen", "Números"),
    ("dezanove", "nineteen", "Números"),
    ("vinte", "twenty", "Números"),
    ("trinta", "thirty", "Números"),
    ("quarenta", "fourty", "Números"),
    ("cinquenta", "fifty", "Números"),
    ("sessenta", "sixty", "Números"),
    ("oitenta", "eighty", "Números"),
    ("noventa", "ninety", "Números"),
    ("cem", "one-hundred", "Números"),
    ("mil", "one-thousand", "Números"),
    ("número", "number", "Números"),
    ("segunda-feira", "monday", "Dias"),
    ("terça-feira", "tuesday", "Dias"),
    ("quarta-feira", "wednesday", "Dias"),
    ("quinta-feira", "thursday", "Dias"),
    ("sexta-feira", "friday", "Dias"),
    ("sábado", "saturday", "Dias"),
    ("domingo", "sunday", "Dias"),
    ("depois de amanhã", "after-tomorrow", "Tempo"),
    ("antes de ontem", "before-yesterday", "Tempo"),
    ("em breve", "soon", "Tempo"),
    ("minuto", "minute", "Tempo"),
    ("data", "date", "Tempo"),
    ("pessoa surda", "deaf-person", "Comunidade"),
    ("pessoa", "person", "Comunidade"),
    ("homem", "man", "Comunidade"),
    ("mulher", "woman", "Comunidade"),
    ("criança", "child", "Comunidade"),
    ("pessoas", "people", "Comunidade"),
    ("grupo", "group", "Comunidade"),
    ("língua gestual", "sign-language", "Comunidade"),
    ("datilologia", "finger-spelling", "Comunidade"),
    ("intérprete", "interpreter", "Comunidade"),
    ("traduzir", "translate", "Comunidade"),
    ("comunicar", "communication", "Comunidade"),
    ("palavra", "word", "Comunidade"),
    ("pergunta", "question", "Comunidade"),
    ("explicar", "explain", "Comunidade"),
    ("entender", "understand", "Comunidade"),
    ("saber", "know", "Comunidade"),
    ("nome", "name", "Apresentar"),
    ("apelido", "surname", "Apresentar"),
    ("apresentar", "introduce", "Apresentar"),
    ("bem-vindo", "welcome", "Apresentar"),
    ("boa sorte", "good-luck", "Apresentar"),
    ("amar", "love", "Apresentar"),
    ("respeitar", "respect", "Apresentar"),
    ("viagem", "trip", "Viagem"),
    ("comboio", "train", "Viagem"),
    ("avião", "airplane", "Viagem"),
    ("hotel", "hotel", "Viagem"),
    ("rua", "street", "Viagem"),
    ("cidade", "city", "Viagem"),
    ("país", "country", "Viagem"),
    ("lugar", "place", "Viagem"),
    ("visitar", "visit", "Viagem"),
    ("longe", "far", "Viagem"),
    ("perto", "near", "Viagem"),
    ("casa de banho pública", "w-c", "Viagem"),
    ("reunião", "meeting", "Encontros"),
    ("conferência", "conference", "Encontros"),
    ("congresso", "congress", "Encontros"),
    ("festival", "festival", "Encontros"),
    ("desporto", "sport", "Encontros"),
    ("filme", "film", "Encontros"),
    ("teatro", "theater", "Encontros"),
    ("pintura", "painting", "Encontros"),
    ("internet", "internet", "Encontros"),
    ("vídeo", "video", "Encontros"),
    ("televisão", "television", "Encontros"),
    ("educação", "education", "Escola"),
    ("universidade", "university", "Escola"),
    ("aula", "lecture", "Escola"),
    ("formatura", "graduation", "Escola"),
    ("praticar", "practice", "Escola"),
    ("tecnologia", "technology", "Escola"),
    ("informática", "computer-science", "Escola"),
    ("lei", "law", "Sociedade"),
    ("regras", "rules", "Sociedade"),
    ("justiça", "justice", "Sociedade"),
    ("governo", "government", "Sociedade"),
    ("parlamento", "parliament", "Sociedade"),
    ("associação", "association", "Sociedade"),
    ("sindicato", "union", "Sociedade"),
    ("discriminação", "discrimination", "Sociedade"),
    ("deficiência", "disability", "Sociedade"),
    ("integração", "integration", "Sociedade"),
    ("solidariedade", "solidarity", "Sociedade"),
    ("liberdade", "freedom", "Sociedade"),
    ("cultura", "culture", "Sociedade"),
    ("história", "history", "Sociedade"),
    ("futuro", "future", "Sociedade"),
    ("esperança", "hope", "Sociedade"),
    ("problema", "problem", "Sociedade"),
    ("conclusão", "conclusion", "Sociedade"),
    ("projeto", "project", "Sociedade"),
    ("trabalho", "work", "Sociedade"),
    ("salário", "salary", "Sociedade"),
    ("imposto", "tax", "Sociedade"),
    ("euro", "euro", "Sociedade"),
    ("dólar", "dollar", "Sociedade"),
]


def carregar_slugs():
    out = {}
    with open(SLUGS, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha:
                continue
            nome, _, id_ = linha.rpartition("-")
            out.setdefault(nome, []).append((linha, id_))
    return out


def resolver(slugs, nome):
    """slug -> (primeiro-id, [todas as variantes]).

    Alguns glosses têm duas ou três entradas na Sématos (learn, wait, year,
    love, know, soon, speak...). Não escolhemos «a» correcta sem ver os
    vídeos: guardamos todas e o site mostra as variantes lado a lado.
    """
    ocorrencias = slugs.get(nome)
    if not ocorrencias:
        return None, []
    return ocorrencias[0][0], [s for s, _ in ocorrencias]


def glossario_pt():
    """Palavras do glossário atual, lidas de app/dados.js sem o importar."""
    texto = open(os.path.join(AQUI, "..", "app", "dados.js"), encoding="utf-8").read()
    import re
    termos = []
    for bloco in re.findall(r"termos:\s*\[(.*?)\]", texto, re.S):
        termos += [t.strip().strip("'").lower() for t in re.findall(r"'([^']+)'", bloco)]
    return sorted(set(termos))


def main():
    slugs = carregar_slugs()

    mapa = {}
    sem_ref = []

    def ligar(pt, nome, tema):
        slug, variantes = resolver(slugs, nome)
        if slug is None:
            sem_ref.append((pt, nome, "slug IS não existe"))
            return False
        mapa[pt] = {
            "slug": slug,
            "glossa": nome,
            "tema": tema,
            "url": BASE + slug,
            "variantes": variantes,
        }
        return True

    for pt, nome in sorted(CORRESPONDENCIAS.items()):
        ligar(pt, nome, None)
    novas = []
    for pt, nome, tema in ADICIONAR:
        if ligar(pt, nome, tema):
            novas.append(pt)

    glossario = glossario_pt()
    cobertas = [p for p in glossario if p in mapa]
    sem_cobertura = [p for p in glossario if p not in mapa]

    partilhadas = {}
    for pt, r in mapa.items():
        partilhadas.setdefault(r["slug"], []).append(pt)
    colensoes = {s: p for s, p in partilhadas.items() if len(p) > 1}

    print("entradas IS na lista: %d" % sum(len(v) for v in slugs.values()))
    print("correspondências usadas: %d" % len(mapa))
    print("  do glossário atual: %d de %d (%.0f%%)" % (
        len(cobertas), len(glossario), 100.0 * len(cobertas) / len(glossario)))
    print("  novas a adicionar: %d" % len(novas))
    print("  com mais do que uma variante IS: %d" % sum(
        1 for r in mapa.values() if len(r["variantes"]) > 1))
    print("\nSEM CORRESPONDÊNCIA IS (%d):" % len(sem_cobertura))
    for i in range(0, len(sem_cobertura), 6):
        print("  " + " · ".join(sem_cobertura[i:i + 6]))
    if sem_ref:
        print("\nPROBLEMAS DE MAPEAMENTO (%d):" % len(sem_ref))
        for pt, nome, aviso in sem_ref:
            print("  %-22s %-18s %s" % (pt, nome, aviso))
    if colensoes:
        print("\nDUAS PALAVRAS PT NO MESMO SINAL IS (%d):" % len(colensoes))
        for s, p in sorted(colensoes.items()):
            print("  %-22s %s" % (s, " = ".join(sorted(p))))

    if "--escrever" in sys.argv:
        with open(SAIDA, "w", encoding="utf-8") as f:
            json.dump(mapa, f, ensure_ascii=False, indent=1, sort_keys=True)
        print("\ngravado em %s" % os.path.relpath(SAIDA, os.path.join(AQUI, "..")))


if __name__ == "__main__":
    main()
