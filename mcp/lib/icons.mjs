/* Rocket Launcher 0.2.3 — store icon checks.
   1. Blank icon: a solid single color or a near-uniform image (no artwork) is flagged.
   2. iOS ↔ Android match: both launcher icons are reduced to small grayscale grids and compared (average hash + mean color).
   Pixels are read with @napi-rs/canvas when it is installed, otherwise with the small PNG decoder below (node:zlib only).
   Read-only: nothing is written or uploaded. */
import zlib from 'node:zlib';

/* ---------- minimal PNG decoder: 8/16-bit gray, gray+alpha, RGB, RGBA, palette (1/2/4/8-bit), interlaced or not ---------- */
export function decodePng(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, W = 0, H = 0, depth = 0, ct = 0, inter = 0, pal = null, trns = null; const idat = [];
  while (o + 8 <= b.length) {
    const len = b.readUInt32BE(o), type = b.toString('latin1', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); depth = d[8]; ct = d[9]; inter = d[12]; }
    else if (type === 'PLTE') pal = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
  }
  if (!W || !H || W * H > 64e6) throw new Error('bad PNG size');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('unsupported PNG color type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, (ch * depth) >> 3), out = new Uint8ClampedArray(W * H * 4);
  const passes = inter ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  let p = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((W - x0) / dx), ph = Math.ceil((H - y0) / dy); if (pw <= 0 || ph <= 0) continue;
    const stride = Math.ceil(pw * ch * depth / 8); let prev = new Uint8Array(stride);
    for (let y = 0; y < ph; y++) {
      const f = raw[p++], line = new Uint8Array(raw.subarray(p, p + stride)); p += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0, u = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        line[i] = (line[i] + (f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : f === 4 ? paeth(a, u, c) : 0)) & 255;
      }
      prev = line;
      for (let x = 0; x < pw; x++) {
        const px = (y0 + y * dy) * W + (x0 + x * dx), q = px * 4; let r, g, bl, al = 255;
        const s = k => depth === 16 ? line[(x * ch + k) * 2] : depth === 8 ? line[x * ch + k] : sub(line, x, depth);
        if (ct === 3) { const ix = s(0); r = pal[ix * 3]; g = pal[ix * 3 + 1]; bl = pal[ix * 3 + 2]; if (trns && ix < trns.length) al = trns[ix]; }
        else if (ct === 0 || ct === 4) { let v = s(0); if (depth < 8) v = Math.round(v * 255 / ((1 << depth) - 1)); r = g = bl = v; if (ct === 4) al = s(1); }
        else { r = s(0); g = s(1); bl = s(2); if (ct === 6) al = s(3); }
        out[q] = r; out[q + 1] = g; out[q + 2] = bl; out[q + 3] = al;
      }
    }
  }
  return { width: W, height: H, data: out };
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
const sub = (line, x, depth) => { const bit = x * depth, byte = line[bit >> 3], sh = 8 - depth - (bit & 7); return (byte >> sh) & ((1 << depth) - 1); };

let canvasLib;
async function canvas() { if (canvasLib === undefined) { try { canvasLib = await import('@napi-rs/canvas'); } catch { canvasLib = null; } } return canvasLib; }

/* RGBA pixels of a data URL / buffer, scaled down to at most `max` px on the long side (box filter). */
export async function pixels(src, max = 64) {
  const buf = typeof src === 'string' ? Buffer.from((src.match(/^data:[^,]*;base64,(.*)$/) || [])[1] || '', 'base64') : Buffer.from(src);
  let img = null;
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) { try { img = decodePng(buf); } catch { img = null; } }
  if (!img) {
    const C = await canvas(); if (!C) return null;
    try { const im = await C.loadImage(buf), cv = C.createCanvas(im.width, im.height), cx = cv.getContext('2d'); cx.drawImage(im, 0, 0); img = { width: im.width, height: im.height, data: cx.getImageData(0, 0, im.width, im.height).data }; }
    catch { return null; }
  }
  return { width: img.width, height: img.height, small: shrink(img, max) };
}
/* Box-filter downscale; transparent pixels are composited over white (the way a store shows a transparent icon area). */
function shrink(img, max) {
  const { width: W, height: H, data } = img, s = Math.max(1, Math.max(W, H) / max), w = Math.max(1, Math.round(W / s)), h = Math.max(1, Math.round(H / s));
  const out = new Float64Array(w * h * 4), cnt = new Float64Array(w * h);
  for (let y = 0; y < H; y++) { const ty = Math.min(h - 1, Math.floor(y * h / H)); for (let x = 0; x < W; x++) {
    const tx = Math.min(w - 1, Math.floor(x * w / W)), i = (y * W + x) * 4, a = data[i + 3] / 255, t = ty * w + tx;
    out[t * 4] += data[i] * a + 255 * (1 - a); out[t * 4 + 1] += data[i + 1] * a + 255 * (1 - a); out[t * 4 + 2] += data[i + 2] * a + 255 * (1 - a); out[t * 4 + 3] += data[i + 3]; cnt[t]++;
  } }
  const px = new Uint8ClampedArray(w * h * 4); for (let t = 0; t < w * h; t++) for (let k = 0; k < 4; k++) px[t * 4 + k] = out[t * 4 + k] / (cnt[t] || 1);
  return { w, h, px };
}
const lum = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/* Blank / near-uniform: few distinct colors (16 levels per channel) or almost no brightness/color spread. */
export function uniformity({ small }) {
  const { w, h, px } = small, n = w * h, q = new Map(); let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, sa = 0;
  for (let t = 0; t < n; t++) { const i = t * 4, l = lum(px, i); sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; sa += px[i + 3]; sl += l; sl2 += l * l;
    const k = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4); q.set(k, (q.get(k) || 0) + 1); }
  const mr = sr / n, mg = sg / n, mb = sb / n, sd = Math.sqrt(Math.max(0, sl2 / n - (sl / n) ** 2));
  let cd = 0; for (let t = 0; t < n; t++) { const i = t * 4; cd += Math.abs(px[i] - mr) + Math.abs(px[i + 1] - mg) + Math.abs(px[i + 2] - mb); } cd /= n * 3;
  const top = Math.max(...q.values()) / n;
  const transparent = sa / n < 8;
  const blank = transparent || q.size <= 2 || top >= 0.985 || (sd < 4 && cd < 4);
  return { blank, transparent, unique_colors: q.size, dominant_share: +top.toFixed(3), brightness_spread: +sd.toFixed(1), color_spread: +cd.toFixed(1), average_color: hex(mr, mg, mb) };
}
/* 8×8 average hash of the icon with transparent/flat borders trimmed, plus its mean color. */
export function ahash({ small }) {
  const { w, h, px } = small;
  /* trim a flat margin (padding / transparent corners of a legacy Android icon) so a padded and a full-bleed icon compare fairly */
  const bg = [px[0], px[1], px[2]], far = i => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 48;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (far((y * w + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0 || (x1 - x0 + 1) * (y1 - y0 + 1) < w * h * 0.2) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, g = new Float64Array(64), c = new Float64Array(64);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = Math.min(7, Math.floor((y - y0) * 8 / bh)) * 8 + Math.min(7, Math.floor((x - x0) * 8 / bw)); g[t] += lum(px, (y * w + x) * 4); c[t]++; }
  for (let t = 0; t < 64; t++) g[t] /= c[t] || 1;
  const m = g.reduce((a, b) => a + b, 0) / 64; let bits = '';
  for (let t = 0; t < 64; t++) bits += g[t] > m ? '1' : '0';
  return bits;
}
const hamming = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
const colorDist = (a, b) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.round(Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0))); };

/* Check the iOS and Android icons found by the analyzer. Returns null when no icon could be read. */
export async function iconCheck(icons) {
  const out = {}; const H = {};
  for (const k of ['ios', 'android']) {
    const ic = icons && icons[k]; if (!ic || !ic.dataUrl) continue;
    const p = await pixels(ic.dataUrl, 64); if (!p) { out[k] = { path: ic.path, readable: false }; continue; }
    const u = uniformity(p); H[k] = { hash: ahash(p), color: u.average_color, blank: u.blank };
    out[k] = { path: ic.path, width: p.width, height: p.height, ...u };
  }
  if (!Object.keys(out).length) return null;
  if (H.ios && H.android) {
    const d = hamming(H.ios.hash, H.android.hash), cd = colorDist(H.ios.color, H.android.color);
    /* One blank and one with artwork can never match; otherwise >20 of 64 hash bits or a very different mean color = mismatch. */
    const match = H.ios.blank !== H.android.blank ? false : H.ios.blank ? cd < 40 : d <= 20 && cd < 90;
    out.match = { similar: match, hash_distance: d, of: 64, color_distance: cd };
  }
  return out;
}
