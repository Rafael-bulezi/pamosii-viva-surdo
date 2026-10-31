"""Reconstrói o rig da Agatha para movimento a sério.

O que está mal no GLB original:
  · o bind pose é uma mão relaxada: falanges 24-27° fora do plano da palma e
    um leque de 34° entre o indicador e o mindinho — todas as formas de mão
    abertas ficavam curvadas e espalhadas sem remédio;
  · cada dedo tem um roll próprio, por isso o eixo da dobra (X local) não está
    no plano da palma;
  · o polegar roda em Z (quase vertical), ou seja "fecha" a abrir para o lado
    em vez de dobrar para a palma;
  · o antebraço é um osso só: a pronação roda a malha toda em torno do osso e
    aperta o pulso (efeito de saco de rebuçado);
  · a mistura de pesos no pulso e no cotovelo tem ~2 cm, o que colapsa a malha
    na dobra.

O que este script faz:
  1. assa um bind plano: falanges direitas no plano da palma, leque natural de
     10° (4/0/-3/-6) e polegar a 42°; os ossos e os vértices são movidos juntos
     (a malha e todas as shape keys), para que "mão aberta" seja zero ângulos;
  2. põe o Z local de todos os ossos da mão = normal da palma, para que o X de
     cada falange seja a dobradiça anatómica;
  3. acrescenta J_Bip_<L|R>_LowerArm_twist entre o cotovelo e o pulso;
  4. alarga a mistura pulso↔antebraço e cotovelo↔braço para ~5-6 cm;
  5. passa parte do peso do antebraço para o osso de torção, em rampa do
     cotovelo (0) ao pulso (1);
  6. limita a 4 influências e normaliza;
  7. exporta para app/assets/agatha-mpfb-rig.glb e imprime a verificação.

Correr:
  blender.exe --background --python tools/melhorar-rig.py

O GLB de origem vive em tools/fonte/ e não é publicado: só o rig reconstruído
vai para app/assets/.
"""

import bpy, os, math, json
from mathutils import Matrix, Vector

AQUI = os.path.dirname(__file__)
ORIGEM = os.path.abspath(os.path.join(AQUI, "fonte", "agatha-mpfb.glb"))
DESTINO = os.path.abspath(os.path.join(AQUI, "..", "app", "assets", "agatha-mpfb-rig.glb"))

BRACO = {"R": 1.0, "L": -1.0}
DEDOS = ("Index", "Middle", "Ring", "Little")
# alvo do bind, em graus no plano da palma, medidos a partir do eixo da mão
# (a linha pulso→nó do dedo médio): leque pequeno e natural
LEQUE_ALVO = {"Index": 4.0, "Middle": 0.0, "Ring": -3.0, "Little": -6.0}
POLEGAR_ALVO = 42.0


def suave(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ORIGEM)

rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
malhas = [o for o in bpy.data.objects if o.type == "MESH" and len(o.vertex_groups)]
bpy.context.view_layer.objects.active = rig

relatorio = {"antes": {}, "depois": {}}


def plano(v, n, base):
    p = v - n * v.dot(n)
    if p.length < 1e-6:
        return 0.0
    p.normalize()
    return math.degrees(math.atan2(p.cross(base).dot(n), p.dot(base)))


def fora(v, n):
    return math.degrees(math.asin(max(-1.0, min(1.0, v.dot(n)))))


def medir(lado):
    ossos = rig.data.bones
    mao = ossos["J_Bip_%s_Hand" % lado]
    ind = ossos["J_Bip_%s_Index1" % lado]
    min_ = ossos["J_Bip_%s_Little1" % lado]
    meio = ossos["J_Bip_%s_Middle1" % lado]
    linha = (min_.head_local - ind.head_local).normalized()
    dir_mao = (meio.head_local - mao.head_local).normalized()
    n = linha.cross(dir_mao).normalized()
    if n.x * BRACO[lado] < 0:
        n.negate()
    return n, dir_mao


def amostra(lado):
    ossos = rig.data.bones
    n, dir_mao = medir(lado)
    saida = {"normal": [round(v, 3) for v in n], "dedos": {}}
    for dedo in ("Index", "Middle", "Ring", "Little", "Thumb"):
        j1 = ossos["J_Bip_%s_%s1" % (lado, dedo)]
        j3 = ossos["J_Bip_%s_%s3" % (lado, dedo)]
        inteiro = (j3.tail_local - j1.head_local).normalized()
        x = j1.matrix_local.to_3x3().col[0].normalized()
        saida["dedos"][dedo] = {
            "leque": round(plano(inteiro, n, dir_mao), 1),
            "fora_do_plano": round(fora(inteiro, n), 1),
            "dobradica_dot_normal": round(x.dot(n), 2),
        }
    return saida


# ------------------------------------------------------------------ 1. medir
ossos = rig.data.bones
normal = {}
eixo_cotovelo = {}
for lado in ("R", "L"):
    normal[lado], _ = medir(lado)
    ante = ossos["J_Bip_%s_LowerArm" % lado]
    braco = ossos["J_Bip_%s_UpperArm" % lado]
    mao = ossos["J_Bip_%s_Hand" % lado]
    eixo_cotovelo[lado] = {
        "ombro": rig.matrix_world @ braco.head_local,
        "cotovelo": rig.matrix_world @ ante.head_local,
        "pulso": rig.matrix_world @ mao.head_local,
    }
    relatorio["antes"][lado] = amostra(lado)

# ------------------------------------------------------ 2. bind plano da mão
mudados = {}


def quadro(head, tail, n):
    """Matriz rígida a partir do eixo do osso e da normal da palma.

    Não usa o roll: mudar o roll não pode mexer na pele, por isso a rotação
    que leva a malha de um bind para o outro é construída só com a cabeça, a
    cauda e a normal.
    """
    y = (tail - head).normalized()
    x = n.cross(y)
    if x.length < 1e-6:
        return None
    x.normalize()
    z = x.cross(y)
    m = Matrix.Identity(4)
    for col, v in enumerate((x, y, z)):
        m[0][col], m[1][col], m[2][col] = v.x, v.y, v.z
    m[0][3], m[1][3], m[2][3] = head.x, head.y, head.z
    return m


antigos = {}
for lado in ("R", "L"):
    n = normal[lado]
    for dedo in DEDOS + ("Thumb",):
        for j in (1, 2, 3):
            nome = "J_Bip_%s_%s%d" % (lado, dedo, j)
            b = ossos.get(nome)
            if b:
                antigos[nome] = quadro(b.head_local.copy(), b.tail_local.copy(), n)
                mudados[nome] = lado

bpy.ops.object.mode_set(mode="EDIT")
eb = rig.data.edit_bones
for lado in ("R", "L"):
    n, base = normal[lado], medir(lado)[1]
    for dedo in DEDOS + ("Thumb",):
        b1 = eb["J_Bip_%s_%s1" % (lado, dedo)]
        b2 = eb["J_Bip_%s_%s2" % (lado, dedo)]
        b3 = eb["J_Bip_%s_%s3" % (lado, dedo)]
        alvo = math.radians(LEQUE_ALVO[dedo] if dedo in LEQUE_ALVO else POLEGAR_ALVO)
        # direcção alvo: eixo da mão rodado no plano da palma até ao leque pedido
        # (o ângulo medido corre do dedo para o eixo, por isso o sinal é o oposto)
        d = base.copy()
        d.rotate(Matrix.Rotation(-alvo, 3, n))
        d.normalize()
        l1, l2, l3 = b1.length, b2.length, b3.length
        b1.tail = b1.head + d * l1
        b2.head, b2.tail = b1.tail, b1.tail + d * l2
        b3.head, b3.tail = b2.tail, b2.tail + d * l3

# rolls anatómicos: Z = normal da palma (X = dobradiça no plano)
for lado in ("R", "L"):
    n = normal[lado]
    for dedo in DEDOS + ("Thumb",):
        for j in (1, 2, 3):
            b = eb.get("J_Bip_%s_%s%d" % (lado, dedo, j))
            if b:
                b.align_roll(n)
    b = eb.get("J_Bip_%s_Hand" % lado)
    if b:
        b.align_roll(n)

# ------------------------------------------------------ 3. osso de torção
for lado in ("R", "L"):
    nome = "J_Bip_%s_LowerArm_twist" % lado
    antigo = eb.get(nome)
    if antigo:
        eb.remove(antigo)
    cotovelo = eb["J_Bip_%s_LowerArm" % lado]
    novo = eb.new(nome)
    novo.head = cotovelo.head.copy()
    novo.tail = eb["J_Bip_%s_Hand" % lado].head.copy()
    novo.roll = cotovelo.roll
    novo.parent = cotovelo
    novo.use_connect = False
    novo.use_deform = True

bpy.ops.object.mode_set(mode="OBJECT")

# --------------------------- levar a malha com os ossos (e com as shape keys)
deltas = {}
for nome, lado in mudados.items():
    b = rig.data.bones[nome]
    novo = quadro(b.head_local.copy(), b.tail_local.copy(), normal[lado])
    if antigos[nome] and novo:
        deltas[nome] = novo @ antigos[nome].inverted()

for obj in malhas:
    indices = {}
    for nome in mudados:
        g = obj.vertex_groups.get(nome)
        if g:
            indices[g.index] = deltas[nome]
    if not indices:
        continue
    mw = obj.matrix_world
    para_rig = rig.matrix_world.inverted() @ mw
    de_rig = para_rig.inverted()
    usados = set()
    novos_co = {}
    for v in obj.data.vertices:
        total = sum(g.weight for g in v.groups)
        if total <= 1e-5:
            continue
        soma = Vector()
        algum = False
        for g in v.groups:
            d = indices.get(g.group)
            if d is None:
                continue
            algum = True
            soma += (d @ (para_rig @ v.co)) * g.weight
        if not algum:
            continue
        base = Vector()
        for g in v.groups:
            if g.group in indices:
                continue
            base += (para_rig @ v.co) * g.weight
        destino = de_rig @ ((soma + base) / total)
        novos_co[v.index] = destino
        usados.add(v.index)
    if not usados:
        continue
    if obj.data.shape_keys:
        for kb in obj.data.shape_keys.key_blocks:
            for i, co in novos_co.items():
                kb.data[i].co = co
    for i, co in novos_co.items():
        obj.data.vertices[i].co = co
    obj.data.update()
    print("BIND", obj.name, "vértices movidos:", len(usados),
          "shape keys:", len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0)

# ------------------------------------------------- 4. pesos suaves e torção
# Calculado em Python e escrito de uma vez. Os operadores normalize_all /
# limit_total corriam antes deste passo e deixaram o osso de torção com peso
# máximo 0.04 no GLB (medido), ou seja, o antebraço não acompanhava a pronação
# e o pulso torcia-se todo num vinco. Aqui cada peso é explícito e verificado.
def ao_longo(obj, lado, v, de, ate):
    d = eixo_cotovelo[lado]
    eixo = (d[ate] - d[de])
    comp = max(1e-6, eixo.length)
    eixo.normalize()
    return ((obj.matrix_world @ v.co) - d[de]).dot(eixo) / comp


for obj in malhas:
    nomes = {g.name for g in obj.vertex_groups}
    rel = relatorio.setdefault("pesos", {}).setdefault(obj.name, {})
    for lado in ("R", "L"):
        prefixo = "J_Bip_%s_" % lado
        alvo = [prefixo + "LowerArm", prefixo + "Hand", prefixo + "UpperArm",
                prefixo + "LowerArm_twist"]
        if prefixo + "LowerArm" not in nomes:
            rel[lado] = {"erro": "sem grupo LowerArm"}
            continue
        gi = {}
        for nome in alvo:
            g = obj.vertex_groups.get(nome) or obj.vertex_groups.new(name=nome)
            gi[nome] = g.index
        g_ant, g_mao, g_braco, g_tor = (gi[n] for n in alvo)

        finais = []
        for v in obj.data.vertices:
            pesos = {g.group: g.weight for g in v.groups if g.weight > 1e-6}
            antes = dict(pesos)
            wb = pesos.get(g_braco, 0.0)
            wl = pesos.get(g_ant, 0.0)
            if wl <= 1e-4 and wb <= 1e-4:
                continue
            # cotovelo: ~6 cm de mistura centrada na articulação
            if wb > 1e-4:
                s = ao_longo(obj, lado, v, "ombro", "cotovelo")
                t = suave((s - 0.86) / 0.26)
                mov = wb * t
                if mov > 1e-6:
                    pesos[g_ant] = wl + mov
                    pesos[g_braco] = wb - mov
                    wl += mov
            if wl <= 1e-4:
                continue
            # pulso: a mão ganha peso ao longo dos últimos ~6 cm do antebraço
            s = ao_longo(obj, lado, v, "cotovelo", "pulso")
            mov = wl * suave((s - 0.82) / 0.26)
            if mov > 1e-6:
                pesos[g_mao] = pesos.get(g_mao, 0.0) + mov
                pesos[g_ant] = wl - mov
                wl -= mov
            # torção: do cotovelo (0) ao pulso (0.90) sobre o que resta
            if s > 0.04 and wl > 1e-4:
                mov = wl * 0.90 * suave((s - 0.04) / 0.84)
                if mov > 1e-6:
                    pesos[g_tor] = pesos.get(g_tor, 0.0) + mov
                    pesos[g_ant] = wl - mov
            if pesos != antes:
                finais.append((v.index, antes, pesos))

        # top 4 influências e normalização, escritas à mão
        for vi, antes, pesos in finais:
            top = sorted(((w, g) for g, w in pesos.items() if w > 1e-6), reverse=True)[:4]
            soma = sum(w for w, _ in top) or 1.0
            novo = {g: w / soma for w, g in top}
            for g in set(antes) | set(novo):
                obj.vertex_groups[g].add([vi], novo.get(g, 0.0), "REPLACE")

        # verificação directa do que ficou escrito
        contagem = {"pulso": 0, "cotovelo": 0, "torcao": 0}
        maximo = {"pulso": 0.0, "cotovelo": 0.0, "torcao": 0.0}
        for vi, _antes, _pesos in finais:
            for v in [obj.data.vertices[vi]]:
                for g in v.groups:
                    for chave, alvo_g in (("pulso", g_mao), ("cotovelo", g_braco), ("torcao", g_tor)):
                        if g.group == alvo_g and g.weight > 0.02:
                            contagem[chave] += 1
                            maximo[chave] = max(maximo[chave], g.weight)
        rel[lado] = {
            "vertices": len(finais),
            "contagem": contagem,
            "peso_max": {k: round(v, 3) for k, v in maximo.items()},
        }
        if len(finais) and maximo["torcao"] < 0.25:
            print("TORCAO_FALHOU", obj.name, lado, maximo["torcao"])

# ------------------------------------------------------------ 5. verificação
for lado in ("R", "L"):
    s = amostra(lado)
    s["osso_torcao"] = "J_Bip_%s_LowerArm_twist" % lado in rig.data.bones
    leques = [s["dedos"][d]["leque"] for d in DEDOS]
    s["leque_total_graus"] = round(max(leques) - min(leques), 1)
    s["dobradica_max_dot_normal"] = max(
        abs(s["dedos"][d]["dobradica_dot_normal"]) for d in DEDOS)
    relatorio["depois"][lado] = s

print("RIG_JSON_START")
print(json.dumps(relatorio, indent=1))
print("RIG_JSON_END")

# --------------------------------------------------------------- 6. exportar
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=DESTINO,
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
print("GLB", DESTINO, os.path.getsize(DESTINO) // 1024, "KB")
