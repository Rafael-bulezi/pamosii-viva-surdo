"""Mede o leque dos dedos no bind pose do GLB, antes de os unir.

Para cada mão: direção de cada falange, ângulo dentro do plano da palma (leque),
ângulo fora do plano (curvatura em repouso) e o peso que cada dedo tem na malha.

Correr:
  blender.exe --background --python tools/medir-mao.py
"""

import bpy, os, math, json
from mathutils import Vector

AQUI = os.path.dirname(__file__)
ORIGEM = os.path.abspath(os.path.join(AQUI, "..", "app", "assets", "agatha-mpfb-rig.glb"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ORIGEM)

rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
ossos = rig.data.bones
malhas = [o for o in bpy.data.objects if o.type == "MESH" and len(o.vertex_groups)]

saida = {}
for lado in ("R", "L"):
    mao = ossos["J_Bip_%s_Hand" % lado]
    ind = ossos["J_Bip_%s_Index1" % lado]
    min_ = ossos["J_Bip_%s_Little1" % lado]
    linha = (min_.head_local - ind.head_local).normalized()
    dir_mao = (ossos["J_Bip_%s_Middle1" % lado].head_local - mao.head_local).normalized()
    n = linha.cross(dir_mao).normalized()
    if n.x * (1.0 if lado == "R" else -1.0) < 0:
        n.negate()

    def plano(v):
        """ângulo (graus) dentro do plano da palma, medido a partir de dir_mao."""
        p = v - n * v.dot(n)
        if p.length < 1e-6:
            return None
        p.normalize()
        return math.degrees(math.atan2(p.cross(dir_mao).dot(n), p.dot(dir_mao)))

    def fora(v):
        return math.degrees(math.asin(max(-1.0, min(1.0, v.dot(n)))))

    dedos = {}
    for dedo in ("Index", "Middle", "Ring", "Little", "Thumb"):
        j1 = ossos["J_Bip_%s_%s1" % (lado, dedo)]
        j2 = ossos["J_Bip_%s_%s2" % (lado, dedo)]
        j3 = ossos["J_Bip_%s_%s3" % (lado, dedo)]
        inteiro = (j3.tail_local - j1.head_local).normalized()
        prox = (j2.head_local - j1.head_local).normalized()
        dedos[dedo] = {
            "leque_falange_graus": round(plano(prox), 1),
            "leque_dedo_graus": round(plano(inteiro), 1),
            "fora_do_plano_graus": round(fora(inteiro), 1),
            "mcp": [round(v, 4) for v in j1.head_local],
            "comprimento": round((j3.tail_local - j1.head_local).length, 4),
        }
    leques = [dedos[d]["leque_falange_graus"] for d in ("Index", "Middle", "Ring", "Little")]
    saida[lado] = {
        "normal": [round(v, 3) for v in n],
        "dir_mao": [round(v, 3) for v in dir_mao],
        "leque_total_falanges_graus": round(max(leques) - min(leques), 1),
        "dedos": dedos,
    }

# quanto cada dedo puxa da malha nos vértices perto do MCP
pesos = {}
for obj in malhas:
    nomes = {g.name for g in obj.vertex_groups}
    if not any(n.startswith("J_Bip_R_Index") for n in nomes):
        continue
    mw = obj.matrix_world
    contagem = {}
    for lado in ("R", "L"):
        for dedo in ("Index", "Middle", "Ring", "Little", "Thumb"):
            grupos = [obj.vertex_groups.get("J_Bip_%s_%s%d" % (lado, dedo, j)) for j in (1, 2, 3)]
            grupos = [g for g in grupos if g]
            idx = {g.index for g in grupos}
            cheios = 0
            for v in obj.data.vertices:
                w = sum(g.weight for g in v.groups if g.group in idx)
                if w > 0.5:
                    cheios += 1
            contagem["%s_%s" % (lado, dedo)] = cheios
    pesos[obj.name] = contagem

saida["vertices_por_dedo"] = pesos
print("MAO_JSON_START")
print(json.dumps(saida, indent=1))
print("MAO_JSON_END")
