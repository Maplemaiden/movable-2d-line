/**
 * Build a transparent blood-stain floor decal for xuanguan hotspot.
 * Colors tuned to cold dirty tile floor (desaturated crimson / dried brown-red).
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 512;
const H = 280;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xb100d01);
const rgba = Buffer.alloc(W * H * 4);

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const oa = rgba[i + 3] / 255;
  const na = a / 255;
  const outA = na + oa * (1 - na);
  if (outA <= 0) return;
  rgba[i] = Math.round((r * na + rgba[i] * oa * (1 - na)) / outA);
  rgba[i + 1] = Math.round((g * na + rgba[i + 1] * oa * (1 - na)) / outA);
  rgba[i + 2] = Math.round((b * na + rgba[i + 2] * oa * (1 - na)) / outA);
  rgba[i + 3] = Math.round(outA * 255);
}

function stampBlob(cx, cy, rx, ry, color, alphaPeak) {
  const x0 = Math.floor(cx - rx - 2);
  const x1 = Math.ceil(cx + rx + 2);
  const y0 = Math.floor(cy - ry - 2);
  const y1 = Math.ceil(cy + ry + 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const edge = Math.pow(1 - d, 1.35);
      const noise = 0.75 + rand() * 0.45;
      const a = Math.max(0, Math.min(255, alphaPeak * edge * noise));
      if (a < 4) continue;
      setPx(x, y, color[0], color[1], color[2], a);
    }
  }
}

function stampStreak(x0, y0, x1, y1, thickness, color, alpha) {
  const steps = Math.max(8, Math.hypot(x1 - x0, y1 - y0) | 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const w = thickness * (1 - t * 0.7);
    stampBlob(x, y, w, w * 0.55, color, alpha * (1 - t * 0.5));
  }
}

// Palette: dried blood that sits on cold grey-blue tiles
const dark = [58, 8, 12];
const mid = [92, 14, 18];
const wet = [118, 22, 26];
const brown = [74, 18, 14];

const cx = W * 0.52;
const cy = H * 0.58;

// main pooled smear (flattened for side-view floor) — 更干、更实，少光晕
stampBlob(cx, cy, 128, 48, dark, 235);
stampBlob(cx - 36, cy + 8, 78, 32, mid, 220);
stampBlob(cx + 52, cy - 2, 68, 28, brown, 210);
stampBlob(cx + 8, cy - 12, 36, 18, wet, 160);

// dragged trail toward door (right)
stampStreak(cx + 40, cy + 8, cx + 175, cy + 16, 9, mid, 200);
stampStreak(cx + 28, cy - 4, cx + 148, cy + 4, 5, brown, 150);

// left splatters
for (let i = 0; i < 14; i++) {
  const ang = -Math.PI * 0.1 + rand() * Math.PI * 1.2;
  const dist = 36 + rand() * 100;
  const sx = cx + Math.cos(ang) * dist;
  const sy = cy + Math.sin(ang) * dist * 0.42;
  stampBlob(sx, sy, 2.5 + rand() * 6, 1.6 + rand() * 3.2, rand() > 0.5 ? mid : dark, 140 + rand() * 80);
}

// tiny droplets（少而干）
for (let i = 0; i < 22; i++) {
  const sx = cx - 140 + rand() * 280;
  const sy = cy - 55 + rand() * 120;
  stampBlob(sx, sy, 1.1 + rand() * 2.2, 0.7 + rand() * 1.4, dark, 120 + rand() * 90);
}

const outDir = path.join(__dirname, '..', 'assets', 'prop');
const out = path.join(outDir, 'blood_stain.png');
const icon = path.join(outDir, 'blood_stain_icon.png');

(async () => {
  const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
  fs.writeFileSync(out, png);
  fs.writeFileSync(icon, png);
  console.log('wrote', out, png.length);
})();
