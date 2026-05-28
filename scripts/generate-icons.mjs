#!/usr/bin/env node
/**
 * Genera los íconos PWA a partir del SVG base.
 *  - icon-192.png / icon-512.png       → "any" purpose (con esquinas redondeadas)
 *  - icon-maskable-192.png / 512.png   → "maskable" purpose (fondo cuadrado lleno)
 *
 * Run: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const ANY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#7C5CFF"/>
  <path d="M168 128h88c70 0 128 57 128 128s-58 128-128 128h-88V128zm60 60v136h28c42 0 76-34 76-68s-34-68-76-68h-28z" fill="#FAFAFA"/>
</svg>`;

// Maskable: el "safe area" es solo el círculo central 80%. El fondo debe
// llenar todo el cuadrado (sin esquinas redondas) — el OS las recorta.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#7C5CFF"/>
  <path d="M188 168h68c54 0 100 44 100 100s-46 100-100 100h-68V168zm46 46v108h22c34 0 60-26 60-54s-26-54-60-54h-22z" fill="#FAFAFA"/>
</svg>`;

const OUT_DIR = "public/icons";
if (!existsSync(OUT_DIR)) {
  await mkdir(OUT_DIR, { recursive: true });
}

const targets = [
  { name: "icon-192.png", svg: ANY_SVG, size: 192 },
  { name: "icon-512.png", svg: ANY_SVG, size: 512 },
  { name: "icon-maskable-192.png", svg: MASKABLE_SVG, size: 192 },
  { name: "icon-maskable-512.png", svg: MASKABLE_SVG, size: 512 },
  // apple-touch-icon: iOS lo lee del head meta; rounded corners los pone iOS.
  { name: "apple-touch-icon.png", svg: MASKABLE_SVG, size: 180 },
];

for (const t of targets) {
  const buf = await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(`${OUT_DIR}/${t.name}`, buf);
  console.log(`✓ ${t.name} (${buf.length} bytes)`);
}

console.log("\nListo. Íconos generados en", OUT_DIR);
