"""Constrói a apresentadora Agatha com MPFB (MakeHuman, CC0) e exporta GLB.

Correr:
  "C:\\Users\\rafae\\AppData\\Local\\Programs\\Blender5.2\\blender-5.2.3-windows-x64\\blender.exe" \
    --background --python tools/build-agatha.py

Ordem: base humana feminina jovem africana → assar macro-detalhe (ficariam no GLB
como 16 morphs inúteis) → afinar o rosto com alvos CC0 (maçãs do rosto, queixo,
nariz, lábios, pálpebras) e assar → pele → rig game_engine (dedos completos) →
sobrancelhas finas, pestanas, dentes, língua → roupa e sapatos → assar a máscara
que esconde o corpo sob a roupa → olhos próprios (esferas com mapa equirretangular
gerado) e cabelo afro procedural (as cartas de cabelo do MakeHuman lêem-se mal) →
expressões → texturas reduzidas → GLB.

O alfa decide-se pela árvore de nós: o exportador glTF só emite OPAQUE se o Alpha
do Principled estiver desligado, e MASK se for um Math GREATER_THAN com constante.
Sem isso o three.js põe tudo transparent + depthWrite off e a cara "fura".
"""

import bpy, os, json, math, random
import numpy as np
from mathutils import Vector

USER_DATA = os.path.join(
    os.environ.get("APPDATA", ""),
    "Blender Foundation", "Blender", "5.2", "extensions", ".user",
    "user_default", "mpfb", "data")
# os alvos de expressão vêm com a extensão; as peças e peles vêm da pasta do utilizador
SYS_DATA = os.path.join(
    os.environ.get("APPDATA", ""),
    "Blender Foundation", "Blender", "5.2", "extensions",
    "user_default", "mpfb", "data")
AQUI = os.path.dirname(__file__)
OUT = os.path.abspath(os.path.join(AQUI, "..", "app", "assets", "agatha-mpfb.glb"))
CAMISOLA = os.path.abspath(os.path.join(AQUI, "assets", "camisola.png"))
TEX_OLHOS = os.path.abspath(os.path.join(AQUI, "assets", "olhos.png"))

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.exportservice import ExportService


def asset(cat, name, ext):
    path = os.path.join(USER_DATA, cat, name, name + ext)
    if not os.path.exists(path):
        raise IOError("asset em falta: " + path)
    return path


def limpar_cena():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def principal(mat):
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def alfa_opaco(obj):
    for slot in obj.material_slots:
        mat = slot.material
        b = principal(mat)
        if not b:
            continue
        ent = b.inputs["Alpha"]
        for l in list(ent.links):
            mat.node_tree.links.remove(l)
        ent.default_value = 1.0
        try:
            mat.blend_method = "OPAQUE"
        except Exception:
            pass


def alfa_mascara(obj, corte=0.45):
    for slot in obj.material_slots:
        mat = slot.material
        b = principal(mat)
        if not b:
            continue
        ent = b.inputs["Alpha"]
        if ent.is_linked:
            origem = ent.links[0].from_socket
            mat.node_tree.links.remove(ent.links[0])
            m = mat.node_tree.nodes.new("ShaderNodeMath")
            m.operation = "GREATER_THAN"
            m.inputs[1].default_value = corte
            m.location = (b.location.x - 260, b.location.y - 320)
            mat.node_tree.links.new(origem, m.inputs[0])
            mat.node_tree.links.new(m.outputs[0], ent)
        else:
            ent.default_value = 1.0
        try:
            mat.blend_method = "CLIP"
        except Exception:
            pass


def pele_mate(obj, rugosidade=0.62):
    for slot in obj.material_slots:
        mat = slot.material
        b = principal(mat)
        if not b:
            continue
        ent = b.inputs["Roughness"]
        for l in list(ent.links):
            mat.node_tree.links.remove(l)
        ent.default_value = rugosidade
        for nome in ("Specular IOR Level", "Specular"):
            if nome in b.inputs:
                b.inputs[nome].default_value = 0.32
                break


def trocar_textura(obj, caminho, marca="diffuse"):
    novo = bpy.data.images.load(caminho, check_existing=True)
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and marca in n.image.name.lower():
                n.image = novo


def assar_chaves(base):
    if not base.data.shape_keys:
        return 0
    bpy.context.view_layer.objects.active = base
    base.select_set(True)
    n = len(base.data.shape_keys.key_blocks) - 1
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    return n


def alvos(base, lista):
    """Aplica alvos faciais CC0 do MakeHuman e assa o resultado em geometria."""
    for pasta, nome, peso in lista:
        p = os.path.join(SYS_DATA, "targets", pasta, nome + ".target.gz")
        try:
            TargetService.load_target(base, p, weight=peso, name=nome)
        except Exception as e:
            print("ALVO falhou", nome, repr(e))
    n = assar_chaves(base)
    print("ROSTO alvos assados:", n)


# ---------------------------------------------------------------- olhos
def textura_olhos(caminho):
    """Mapa equirretangular: íris no equador à frente (u=0,5 v=0,5)."""
    S = 2                      # super-amostragem
    W, H = 512 * S, 256 * S
    img = np.zeros((H, W, 3), dtype=np.float32)
    img[:, :] = (0.80, 0.775, 0.745)          # esclera
    yy = np.linspace(-1, 1, H)[:, None]
    xx = np.linspace(-1, 1, W)[None, :]
    sombra = np.clip((np.abs(yy) - 0.55) * 0.9, 0, 1) * 0.16
    img *= (1.0 - sombra)[..., None]

    cx, cy = W / 2.0, H / 2.0
    px, py = (xx[0] + 1) * 0.5 * W - cx, (yy[:, 0] + 1) * 0.5 * H - cy
    PX, PY = np.meshgrid(px, py)
    R = np.sqrt(PX ** 2 + PY ** 2)
    T = np.arctan2(PY, PX)

    r_iris, r_pupila = 36.0 * S, 15.0 * S
    dentro = R <= r_iris
    t = np.clip(R / r_iris, 0, 1)
    fibra = 0.5 + 0.5 * np.sin(T * 37.0) * 0.12 + 0.5 * np.sin(T * 61.0 + 1.7) * 0.08
    r_cor = 0.50 - 0.34 * t + 0.10 * fibra * (1 - t)
    g_cor = 0.29 - 0.20 * t + 0.07 * fibra * (1 - t)
    b_cor = 0.13 - 0.08 * t + 0.04 * fibra * (1 - t)
    limbo = np.clip((t - 0.80) / 0.20, 0, 1)      # anel escuro na borda
    r_cor *= (1 - 0.85 * limbo)
    g_cor *= (1 - 0.85 * limbo)
    b_cor *= (1 - 0.85 * limbo)
    for canal, valor in enumerate((r_cor, g_cor, b_cor)):
        img[..., canal] = np.where(dentro, valor, img[..., canal])
    pupila = R <= r_pupila
    for canal in range(3):
        img[..., canal] = np.where(pupila, 0.015 + 0.01 * (R / r_pupila), img[..., canal])

    # brilho e brilho secundário
    for ox, oy, raio, forca in ((-7.5, -7.5, 3.4, 1.0), (6.0, 5.5, 1.7, 0.5)):
        d = np.sqrt((PX - ox * S) ** 2 + (PY - oy * S) ** 2)
        a = np.clip((raio * S - d) / (1.6 * S), 0, 1) * forca
        for canal in range(3):
            img[..., canal] = img[..., canal] * (1 - a) + 0.99 * a

    # reduzir para 512x256
    img = img.reshape(256, S, 512, S, 3).mean(axis=(1, 3))
    rgba = np.ones((256, 512, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(img, 0, 1)
    saida = bpy.data.images.new("olhos", 512, 256, alpha=True)
    saida.pixels = rgba[::-1].ravel().tolist()
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    saida.filepath_raw = caminho
    saida.file_format = "PNG"
    saida.save()
    print("TEX olhos", caminho)


def centro_dos_olhos(objeto):
    """Duas conchas do asset de olhos -> centro e raio de cada uma."""
    mw = objeto.matrix_world
    co = [mw @ v.co for v in objeto.data.vertices]
    esq = [v for v in co if v.x > 0]
    dir_ = [v for v in co if v.x <= 0]
    saida = []
    for grupo in (esq, dir_):
        c = sum(grupo, Vector()) / len(grupo)
        r = max((v - c).length for v in grupo)
        saida.append((c, r))
    return saida


def criar_olhos(base, rig, centros, caminho_textura):
    mat = bpy.data.materials.new("Olhos")
    mat.use_nodes = True
    b = principal(mat)
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(caminho_textura, check_existing=True)
    tex.location = (-460, 260)
    mat.node_tree.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.18
    for nome, valor in (("Specular IOR Level", 0.55), ("Specular", 0.55)):
        if nome in b.inputs:
            b.inputs[nome].default_value = valor
            break

    olhos = []
    for c, _r in centros:
        raio_olho = 0.0135
        mw = base.matrix_world
        ys = sorted((mw @ v.co).y for v in base.data.vertices
                    if abs((mw @ v.co).x - c.x) < 0.021
                    and abs((mw @ v.co).z - c.z) < 0.015)
        y_abertura = ys[max(0, len(ys) // 5)] if ys else c.y + 0.012
        centro = Vector((c.x, y_abertura + raio_olho - 0.001, c.z))
        print("OLHO esq/dir centro", tuple(round(x, 4) for x in centro),
              "abertura", round(y_abertura, 4))
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=40, ring_count=24, radius=raio_olho, location=centro)
        o = bpy.context.object
        o.name = "Olho"
        me = o.data
        me.materials.append(mat)
        # UV equirretangular, frente do rosto em -Y
        uvl = me.uv_layers.active or me.uv_layers.new(name="UVMap")
        for pol in me.polygons:
            for li in pol.loop_indices:
                vi = me.loops[li].vertex_index
                p = me.vertices[vi].co
                lon = math.atan2(p.x, -p.y)
                lat = math.asin(max(-1.0, min(1.0, p.z / p.length)))
                uvl.data[li].uv = (0.5 + lon / (2 * math.pi), 0.5 + lat / math.pi)
        for pol in me.polygons:
            pol.use_smooth = True
        vg = o.vertex_groups.new(name="head")
        vg.add(list(range(len(me.vertices))), 1.0, "REPLACE")
        o.parent = rig
        mod = o.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        olhos.append(o)
    print("OLHOS criados:", len(olhos))


# ---------------------------------------------------------------- cabelo
def criar_cabelo(rig, caixa, z_olhos):
    """Afro: casco ondulado colado ao crânio + superficie de tufos pequenos e densos."""
    import bmesh
    from mathutils import Matrix, noise as bnoise
    acaso = random.Random(11)
    x0, x1, y0, y1, z0, z1 = caixa
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    meia_l = (x1 - x0) / 2
    meia_p = (y1 - y0) / 2
    topo = z1
    cranio = Vector((cx, cy + 0.004, topo - 0.100))
    cranio_r = Vector((meia_l * 1.04, meia_p * 1.00, 0.120))
    centro = Vector((cx, cy - 0.004, topo - 0.072))
    raio = Vector((meia_l * 1.21, meia_p * 1.16, topo + 0.042 - centro.z))
    z_linha_frente = z_olhos + 0.065
    print("CABELO centro", tuple(round(v, 3) for v in centro),
          "raio", tuple(round(v, 3) for v in raio),
          "linha", round(z_linha_frente, 3))

    def linha_de(p):
        frente = (p.y - (cy - meia_p)) / max(1e-5, 2 * meia_p)
        frente = min(max(frente, 0.0), 1.0)
        linha = z_linha_frente - 0.100 * frente
        return linha - 0.030 * min(1.0, abs(p.x) / max(1e-5, meia_l))

    bm = bmesh.new()

    # casca: fecha os buracos entre tufos e dá o volume do afro
    casca = bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    for v in casca["verts"]:
        d = v.co.normalized()
        k = 1.0 + 0.050 * bnoise.noise(d * 5.5) + 0.020 * bnoise.noise(d * 15.0)
        v.co = Vector((cranio.x + d.x * cranio_r.x * k,
                       cranio.y + d.y * cranio_r.y * k,
                       cranio.z + d.z * cranio_r.z * k))
    bmesh.ops.delete(bm, geom=[v for v in casca["verts"] if v.co.z < linha_de(v.co) - 0.004],
                     context="VERTS")
    casca_verts = len(bm.verts)

    n = 1500
    tufos = 0
    for i in range(n):
        z = 1.0 - 2.0 * (i + 0.5) / n
        anel = math.sqrt(max(0.0, 1.0 - z * z))
        th = i * 2.399963229728653
        d = Vector((math.cos(th) * anel, math.sin(th) * anel, z))
        camadas = [(1.0, 0.0026, 0.0064, 0.006)]
        if i % 3 == 0:
            camadas.append((0.945, 0.0072, 0.0122, -0.004))
        for escala, rmin, rmax, margem in camadas:
            # silhueta irregular: um afro não é uma esfera perfeita
            kp = 1.0 + 0.048 * bnoise.noise(d * 3.1)
            p = centro + Vector((d.x * raio.x * escala * kp,
                                 d.y * raio.y * escala * kp,
                                 d.z * raio.z * escala * kp))
            if p.z < linha_de(p) + margem:
                continue
            r = acaso.uniform(rmin, rmax)
            p += Vector((acaso.uniform(-0.003, 0.003),
                         acaso.uniform(-0.003, 0.003),
                         acaso.uniform(-0.002, 0.002)))
            m = (Matrix.Translation(p)
                 @ Matrix.Rotation(acaso.uniform(0.0, 6.283), 4, "Z")
                 @ Matrix.Diagonal(Vector((r, r * acaso.uniform(0.85, 1.15),
                                           r * acaso.uniform(0.7, 0.95)))).to_4x4())
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=m)
            tufos += 1

    me = bpy.data.meshes.new("AfroMalha")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("Afro", me)
    bpy.context.collection.objects.link(o)
    for pol in me.polygons:
        pol.use_smooth = True

    mat = bpy.data.materials.new("Cabelo")
    mat.use_nodes = True
    b = principal(mat)
    b.inputs["Base Color"].default_value = (0.030, 0.022, 0.017, 1)
    b.inputs["Roughness"].default_value = 0.78
    for nome in ("Specular IOR Level", "Specular"):
        if nome in b.inputs:
            b.inputs[nome].default_value = 0.28
            break
    me.materials.append(mat)

    vg = o.vertex_groups.new(name="head")
    vg.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    o.parent = rig
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    print("CABELO tufos:", tufos, "casca:", casca_verts, "vértices:", len(me.vertices))


OSSOS = {
    "pelvis": "J_Bip_C_Hips",
    "spine_01": "J_Bip_C_Spine",
    "spine_02": "J_Bip_C_Chest",
    "spine_03": "J_Bip_C_UpperChest",
    "neck_01": "J_Bip_C_Neck",
    "head": "J_Bip_C_Head",
}
for _lado, _p in (("l", "L"), ("r", "R")):
    OSSOS.update({
        "clavicle_" + _lado: "J_Bip_" + _p + "_Shoulder",
        "upperarm_" + _lado: "J_Bip_" + _p + "_UpperArm",
        "lowerarm_" + _lado: "J_Bip_" + _p + "_LowerArm",
        "hand_" + _lado: "J_Bip_" + _p + "_Hand",
        "thigh_" + _lado: "J_Bip_" + _p + "_UpperLeg",
        "calf_" + _lado: "J_Bip_" + _p + "_LowerLeg",
        "foot_" + _lado: "J_Bip_" + _p + "_Foot",
        "ball_" + _lado: "J_Bip_" + _p + "_Toes",
    })
    for _dedo, _nome in (("index", "Index"), ("middle", "Middle"), ("ring", "Ring"),
                         ("pinky", "Little"), ("thumb", "Thumb")):
        for _j in (1, 2, 3):
            OSSOS["%s_0%d_%s" % (_dedo, _j, _lado)] = "J_Bip_%s_%s%d" % (_p, _nome, _j)


def renomear_ossos(rig):
    for osso in list(rig.data.bones):
        novo = OSSOS.get(osso.name)
        if novo:
            osso.name = novo
    for obj in bpy.data.objects:
        for vg in obj.vertex_groups:
            novo = OSSOS.get(vg.name)
            if novo:
                vg.name = novo
    print("OSSOS com nome da app:", sum(1 for b in rig.data.bones if b.name.startswith("J_Bip")))


def main():
    limpar_cena()

    macro = TargetService.get_default_macro_info_dict()
    macro.update({
        "gender": 1.0,
        "age": 0.42,
        "muscle": 0.30,
        "weight": 0.42,
        "proportions": 0.5,
        "height": 0.48,
        "cupsize": 0.45,
        "firmness": 0.55,
        "race": {"asian": 0.0, "caucasian": 0.02, "african": 0.98},
    })
    base = HumanService.create_human(macro_detail_dict=macro)
    print("BASE", base.name, tuple(round(v, 3) for v in base.dimensions))
    print("MACRO assado, chaves removidas:", assar_chaves(base))

    alvos(base, [
        ("head", "head-oval", 0.35),
        ("cheek", "l-cheek-bones-incr", 0.55),
        ("cheek", "r-cheek-bones-incr", 0.55),
        ("cheek", "l-cheek-volume-decr", 0.30),
        ("cheek", "r-cheek-volume-decr", 0.30),
        ("chin", "chin-prominent-incr", 0.35),
        ("chin", "chin-width-decr", 0.20),
        ("nose", "nose-flaring-incr", 0.45),
        ("nose", "nose-width2-incr", 0.30),
        ("nose", "nose-hump-decr", 0.30),
        ("nose", "nose-volume-incr", 0.20),
        ("mouth", "mouth-upperlip-volume-incr", 0.35),
        ("mouth", "mouth-lowerlip-volume-incr", 0.40),
        ("mouth", "mouth-cupidsbow-incr", 0.20),
        ("eyes", "l-eye-eyefold-up", 0.35),
        ("eyes", "r-eye-eyefold-up", 0.35),
        ("forehead", "forehead-nubian-incr", 0.30),
    ])

    HumanService.set_character_skin(
        asset("skins", "young_african_female", ".mhmat"), base, skin_type="GAMEENGINE")
    pele_mate(base, 0.62)

    rig = HumanService.add_builtin_rig(base, "game_engine", import_weights=True)
    print("RIG", rig.name if rig else None, len(rig.data.bones) if rig else 0)

    pecas = [
        ("eyebrows", "eyebrow001", "Eyebrows"),
        ("eyelashes", "eyelashes01", "Eyelashes"),
        ("teeth", "teeth_base", "Teeth"),
        ("tongue", "tongue01", "Tongue"),
        ("clothes", "female_casualsuit02", "Clothes"),
        ("clothes", "shoes03", "Clothes"),
    ]
    feitos = {}
    for cat, name, tipo in pecas:
        try:
            obj = HumanService.add_mhclo_asset(
                asset(cat, name, ".mhclo"), base, asset_type=tipo,
                material_type="GAMEENGINE", set_up_rigging=True, import_weights=True)
            feitos[(cat, name)] = obj
            print("PEÇA", tipo, name, "->", obj.name if obj else "falhou")
        except Exception as e:
            print("PEÇA_FALHOU", tipo, name, repr(e))

    if feitos.get(("clothes", "female_casualsuit02")) and os.path.exists(CAMISOLA):
        trocar_textura(feitos[("clothes", "female_casualsuit02")], CAMISOLA)

    for (cat, name), obj in feitos.items():
        if not obj:
            continue
        if cat in ("eyebrows", "eyelashes"):
            alfa_mascara(obj, 0.35)
        else:
            alfa_opaco(obj)
    alfa_opaco(base)

    # olhos: medir o encaixe do asset e trocá-lo por esferas com mapa próprio
    olho_asset = HumanService.add_mhclo_asset(
        asset("eyes", "high-poly", ".mhclo"), base, asset_type="Eyes",
        material_type="GAMEENGINE", set_up_rigging=False, import_weights=False)
    centros = centro_dos_olhos(olho_asset)
    print("OLHOS encaixe", [(tuple(round(x, 3) for x in c), round(r, 4)) for c, r in centros])
    bpy.data.objects.remove(olho_asset, do_unlink=True)

    # geometria do crânio para o cabelo
    zmax = max((base.matrix_world @ v.co).z for v in base.data.vertices)
    todos = [base.matrix_world @ v.co for v in base.data.vertices]
    cabeca = [v for v in todos if v.z > zmax - 0.20 and abs(v.x) < 0.18]
    caixa = (min(v.x for v in cabeca), max(v.x for v in cabeca),
             min(v.y for v in cabeca), max(v.y for v in cabeca),
             min(v.z for v in cabeca), zmax)
    print("CABECA caixa", tuple(round(x, 3) for x in caixa))

    try:
        ExportService.bake_modifiers_remove_helpers(
            base, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=False)
        print("MASCARA assada; vértices:", len(base.data.vertices))
    except Exception as e:
        print("MASCARA_FALHOU", repr(e))

    textura_olhos(TEX_OLHOS)
    criar_olhos(base, rig, centros, TEX_OLHOS)
    z_olhos = sum(c.z for c, _ in centros) / len(centros)
    criar_cabelo(rig, caixa, z_olhos)

    expressoes = {
        "eye-left-closure": "olho_fecha_L",
        "eye-right-closure": "olho_fecha_R",
        "eyebrows-left-up": "sobrancelha_sobe_L",
        "eyebrows-right-up": "sobrancelha_sobe_R",
        "mouth-open": "boca_abre",
    }
    for alvo, nome in expressoes.items():
        try:
            p = os.path.join(SYS_DATA, "targets", "expression", "units", "african", alvo + ".target.gz")
            TargetService.load_target(base, p, weight=0.0, name=nome)
        except Exception as e:
            print("EXPR falhou", alvo, repr(e))
    try:
        FaceService.interpolate_targets(base)
        print("EXPR interpoladas para as peças")
    except Exception as e:
        print("EXPR interpolação falhou", repr(e))

    if base.data.shape_keys:
        print("SHAPEKEYS", [k.name for k in base.data.shape_keys.key_blocks])

    for img in bpy.data.images:
        if img.size[0] == 0:
            continue
        w, h = img.size
        maior = max(w, h)
        limite = 2048 if "darkskinned" in img.name else 1024
        if maior > limite:
            f = float(limite) / maior
            img.scale(int(w * f), int(h * f))
            print("TEX", img.name, (w, h), "->", tuple(img.size))

    renomear_ossos(rig)

    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig or base

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_skins=True,
        export_morph=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_image_format="AUTO",
    )
    print("GLB", OUT, os.path.getsize(OUT) // 1024, "KB")


main()
