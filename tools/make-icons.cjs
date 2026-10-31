/* Gera os ícones PNG do manifest a partir da marca provisória (app/assets/logo-mark.svg).

   Não é um logótipo novo: é a mesma marca (rectângulo arredondado verde + "V" escuro +
   dois pontos) rasterizada, porque o "Adicionar ao ecrã principal" do iOS e vários
   launchers Android pedem PNG e ignoram SVG.

   Quando a Viva Surdo entregar o logótipo oficial, substituir o desenho nas funções
   `desenhaMarca` / `desenhaFundo` abaixo e correr:  node tools/make-icons.cjs
   (ou, simplesmente, entregar icon-192.png, icon-512.png e icon-maskable-512.png
   feitos pelo designer — ver README, "Substituir a marca provisória"). */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'app', 'assets');
const VERDE = [0x58 / 255, 0xcc / 255, 0x02 / 255];
const TINTA = [0x12 / 255, 0x30 / 255, 0x00 / 255];

/* ---- geometria no viewBox 64×64 (a mesma do SVG) ---- */
const V = [[17, 22], [32, 48], [47, 22]];
const V_LARGURA = 6.5;
const PONTOS = [[15, 13, 4], [49, 13, 4]];

function segDist(px, py, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = px - a[0], wy = py - a[1];
  const d = vx * vx + vy * vy;
  const t = d === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / d));
  return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
}
function marcaAlpha(x, y) {
  /* dentro do traçado = distância aos dois segmentos ≤ metade da largura (cap redondo) */
  const d = Math.min(segDist(x, y, V[0], V[1]), segDist(x, y, V[1], V[2]));
  return d <= V_LARGURA / 2;
}
function pontoAlpha(x, y) {
  return PONTOS.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r);
}
function rectArredondadoAlpha(x, y, tam, raio) {
  /* SDF de rectângulo arredondado: q = |p| - b + r, d = |max(q,0)| + min(max(qx,qy),0) - r */
  const b = tam / 2;
  const qx = Math.abs(x - b) - b + raio;
  const qy = Math.abs(y - b) - b + raio;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - raio;
  return d <= 0;
}

/* ---- rasterizador: 3×3 amostras por pixel, sem dependências ---- */
function renderizar(n, { maskable }) {
  /* o icon "maskable" tem de encher a tela toda (o launcher recorta em círculo/quadrado),
     por isso o fundo vai a sangue e a marca é escalada para ficar dentro da zona
     segura de 80% — em cima do centro do canvas, não do centro óptico do desenho. */
  const escala = maskable ? 0.85 : 1;
  const raioFundo = 15;          /* rx="15" do SVG, no mesmo viewBox 64 */
  const px = new Uint8Array(n * n * 4);
  const sub = 3, passo = 1 / sub;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let fundo = 0, marca = 0;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const vx = (i + sx * passo + passo / 2) * 64 / n;
          const vy = (j + sy * passo + passo / 2) * 64 / n;
          /* coordenada no desenho original, centrada e escalada */
          const mx = (vx - 32) / escala + 32;
          const my = (vy - 32) / escala + 32;
          if (maskable ? true : rectArredondadoAlpha(vx, vy, 64, raioFundo)) fundo++;
          if (marcaAlpha(mx, my) || pontoAlpha(mx, my)) marca++;
        }
      }
      const aFundo = fundo / (sub * sub), aMarca = marca / (sub * sub);
      /* marca por cima do fundo; fora do fundo fica transparente */
      const r = VERDE[0] * (1 - aMarca) + TINTA[0] * aMarca;
      const g = VERDE[1] * (1 - aMarca) + TINTA[1] * aMarca;
      const b = VERDE[2] * (1 - aMarca) + TINTA[2] * aMarca;
      const alfa = maskable ? 1 : aFundo;
      const k = (j * n + i) * 4;
      px[k] = Math.round(r * 255);
      px[k + 1] = Math.round(g * 255);
      px[k + 2] = Math.round(b * 255);
      px[k + 3] = Math.round(alfa * 255);
    }
  }
  return px;
}

/* ---- codificador PNG mínimo (RGBA 8-bit, sem filtros) ---- */
const crcTabela = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTabela[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}
function png(n, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const linhas = Buffer.alloc(n * (n * 4 + 1));
  for (let j = 0; j < n; j++) {
    linhas[j * (n * 4 + 1)] = 0;
    Buffer.from(px.buffer, px.byteOffset + j * n * 4, n * 4).copy(linhas, j * (n * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [nome, tam, opts] of [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
]) {
  const f = path.join(OUT, nome);
  fs.writeFileSync(f, png(tam, renderizar(tam, opts)));
  console.log(nome, tam + 'px', fs.statSync(f).size + ' bytes');
}
