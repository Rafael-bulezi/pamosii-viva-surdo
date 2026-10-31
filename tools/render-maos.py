"""Renderiza as mãos de um GLB para inspeção (palma, dorso e perfil).

  blender.exe --background --python tools/render-maos.py -- <glb> <prefixo>
"""

import bpy, os, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = argv[0]
PREFIXO = argv[1] if len(argv) > 1 else "maos"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
bpy.context.view_layer.update()

cena = bpy.context.scene
cena.render.engine = "BLENDER_WORKBENCH"
cena.display.shading.light = "STUDIO"
cena.display.shading.color_type = "MATERIAL"
cena.display.shading.show_shadows = True
cena.display.shading.show_cavity = True
cena.render.resolution_x = 800
cena.render.resolution_y = 800
cena.render.film_transparent = False

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 0.26
cam = bpy.data.objects.new("Cam", cam_data)
cena.collection.objects.link(cam)
cena.camera = cam

ossos = rig.data.bones
for lado in ("R", "L"):
    ind = ossos["J_Bip_%s_Index1" % lado]
    min_ = ossos["J_Bip_%s_Little1" % lado]
    meio = ossos["J_Bip_%s_Middle1" % lado]
    mao = ossos["J_Bip_%s_Hand" % lado]
    linha = (min_.head_local - ind.head_local).normalized()
    dir_mao = (meio.head_local - mao.head_local).normalized()
    n = linha.cross(dir_mao).normalized()
    if n.x * (1.0 if lado == "R" else -1.0) < 0:
        n.negate()
    dedos = [ossos["J_Bip_%s_%s3" % (lado, d)].tail_local for d in ("Index", "Middle", "Ring", "Little")]
    centro = (mao.head_local + sum(dedos, Vector()) / 4) * 0.5
    foco = rig.matrix_world @ centro
    for nome, direc, cima in (
        ("palma", n, dir_mao),
        ("dorso", -n, dir_mao),
        ("perfil", linha, dir_mao),
    ):
        cam.location = foco + direc.normalized() * 0.6
        q = (foco - cam.location).to_track_quat("-Z", "Y")
        # alinhar o eixo da mão com o eixo vertical da imagem
        eixo = (q @ Vector((0, 1, 0)))
        corrigir = eixo.rotation_difference(cima)
        cam.rotation_euler = (corrigir @ q).to_euler()
        cena.render.filepath = "%s-%s-%s.png" % (PREFIXO, lado, nome)
        bpy.ops.render.render(write_still=True)
        print("RENDER", cena.render.filepath)
