"""Audita o rig do GLB que a app usa: ossos, eixos, pesos e zonas de dobra.

Correr:
  blender.exe --background --python tools/auditar-rig.py
"""

import bpy, json, os, math
from mathutils import Vector

AQUI = os.path.dirname(__file__)
GLB = os.path.abspath(os.path.join(AQUI, "..", "app", "assets", "agatha-mpfb.glb"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

rel = {}
for o in bpy.data.objects:
    rel[o.name] = {"type": o.type, "verts": len(o.data.vertices) if o.type == "MESH" else None,
                   "groups": len(o.vertex_groups) if o.type == "MESH" else None,
                   "parent": o.parent.name if o.parent else None}

rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
malhas = [o for o in bpy.data.objects if o.type == "MESH" and len(o.vertex_groups)]

saida = {"objects": rel}

if rig:
    ossos = []
    for b in rig.data.bones:
        ossos.append({
            "name": b.name,
            "parent": b.parent.name if b.parent else None,
            "deform": b.use_deform,
            "connect": b.use_connect,
            "head": [round(v, 4) for v in b.head_local],
            "tail": [round(v, 4) for v in b.tail_local],
            "roll": round(math.degrees(b.matrix_local.to_euler().y), 1),
            "len": round(b.length, 4),
        })
    saida["bones"] = ossos
    saida["bone_count"] = len(ossos)

    # eixos locais dos dedos e da mão: o eixo de dobradiça tem de ser o X
    nomes = [b.name for b in rig.data.bones]
    eixos = {}
    for n in nomes:
        if ("Hand" in n or "Thumb" in n or "Index" in n or "Middle" in n
                or "Ring" in n or "Little" in n or "LowerArm" in n):
            b = rig.data.bones[n]
            m = b.matrix_local.to_3x3()
            eixos[n] = {
                "x": [round(v, 3) for v in m.col[0]],
                "y": [round(v, 3) for v in m.col[1]],
                "z": [round(v, 3) for v in m.col[2]],
            }
    saida["eixos"] = eixos

    # pesos: estatística por grupo e a zona do punho/ cotovelo
    for obj in malhas:
        info = {"nome": obj.name, "vertices": len(obj.data.vertices), "grupos": {}}
        gname = {g.index: g.name for g in obj.vertex_groups}
        soma = {}
        influencias = {}
        for v in obj.data.vertices:
            n = 0
            for g in v.groups:
                if g.weight > 1e-4:
                    n += 1
                    soma[gname[g.group]] = soma.get(gname[g.group], 0.0) + g.weight
            influencias[n] = influencias.get(n, 0) + 1
        info["peso_total_por_grupo"] = {k: round(v, 1) for k, v in sorted(soma.items())}
        info["influencias_por_vertice"] = dict(sorted(influencias.items()))
        info["max_influencias"] = max(influencias) if influencias else 0

        # zona do punho direito: vértices a menos de 4 cm do osso Hand
        mao = rig.data.bones.get("J_Bip_R_Hand")
        if mao:
            cabeca = mao.head_local
            perto = []
            for v in obj.data.vertices:
                d = (v.co - cabeca).length
                if d < 0.05:
                    ws = {gname[g.group]: round(g.weight, 3) for g in v.groups if g.weight > 1e-3}
                    perto.append({"d": round(d, 3), "w": ws})
            perto.sort(key=lambda x: x["d"])
            info["punho_R_5cm"] = perto[:24]
            info["punho_R_contagem"] = len(perto)
        saida[obj.name] = info

print("AUDIT_JSON_START")
print(json.dumps(saida, indent=1))
print("AUDIT_JSON_END")
