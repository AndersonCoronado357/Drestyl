"use client";

import imageCompression from "browser-image-compression";

const COMPRESS_OPTS = {
  maxSizeMB: 0.9,
  maxWidthOrHeight: 1536,
  useWebWorker: true,
  fileType: "image/webp" as const,
  initialQuality: 0.9,
};

/** Compresión rápida sin quitar fondo. ~200-500ms en mobile típico. */
export async function justCompress(input: File): Promise<File> {
  const compressed = await imageCompression(input, COMPRESS_OPTS);
  return new File([compressed], "garment.webp", { type: "image/webp" });
}

/**
 * Miniatura (~1024px, ~250KB) para la IA. Suficiente para que Gemini lea
 * logos pequeños sin pesar mucho.
 */
export async function quickThumbnail(input: File): Promise<File> {
  const compressed = await imageCompression(input, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.82,
  });
  return new File([compressed], "thumb.webp", { type: "image/webp" });
}

// ─── Bg removal CLIENT-SIDE (main thread) ────────────────────────────────
// Modelo RMBG-1.4 vía @huggingface/transformers, corriendo inline en el
// hilo principal. WebGPU si está disponible (~500ms-1s), si no WASM con
// dtype q8 (~3-5s por foto en mobile típico).
//
// Intenté moverlo a Web Worker pero Turbopack en dev no bundle bien
// `new URL('./worker', import.meta.url)` con @huggingface/transformers
// dentro — fallaba silenciosamente en mobile. Mejor probado y funcionando
// inline que roto en Worker.

/* eslint-disable @typescript-eslint/no-explicit-any */

let modelPromise: Promise<any> | null = null;

async function loadModel(): Promise<any> {
  const tx = await import("@huggingface/transformers");
  tx.env.allowLocalModels = false;

  let device: "webgpu" | "wasm" = "wasm";
  try {
    const navGpu = (navigator as unknown as {
      gpu?: { requestAdapter(): Promise<unknown> };
    }).gpu;
    if (navGpu) {
      const adapter = await navGpu.requestAdapter();
      if (adapter) device = "webgpu";
    }
  } catch {
    /* fallback wasm */
  }
  const dtype = device === "webgpu" ? "fp16" : "q8";
  console.log(`[bg-removal] device: ${device}, dtype: ${dtype}`);

  const model = await tx.AutoModel.from_pretrained("briaai/RMBG-1.4", {
    device,
    dtype,
  });
  const processor = await tx.AutoProcessor.from_pretrained("briaai/RMBG-1.4");
  return { model, processor, RawImage: tx.RawImage };
}

/** Pre-descarga el modelo. Llamar al entrar al flow/closet para tener
 *  el modelo listo cuando se procese la primera foto. */
export async function preloadBackgroundModel(): Promise<void> {
  try {
    if (!modelPromise) modelPromise = loadModel();
    await modelPromise;
  } catch (err) {
    console.warn("[preloadBackgroundModel] falló:", err);
    modelPromise = null;
  }
}

/**
 * Aplica RMBG-1.4 a la foto. Devuelve WebP con transparencia.
 *
 * Optimización mobile: pre-encogemos a 1024px antes de la inferencia. El
 * modelo procesa a 1024x1024 internamente, así que entradas más grandes
 * solo desperdician decode + resize.
 */
export async function removeBackgroundAndCompress(input: File): Promise<File> {
  if (!modelPromise) modelPromise = loadModel();
  const { model, processor, RawImage } = await modelPromise;

  const shrunk = await imageCompression(input, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85,
  });

  const url = URL.createObjectURL(shrunk);
  let rawImage: { width: number; height: number };
  try {
    rawImage = await RawImage.fromURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const width = rawImage.width;
  const height = rawImage.height;

  const { pixel_values } = await processor(rawImage);
  const { output } = await model({ input: pixel_values });

  const maskTensor = output[0].mul(255).to("uint8");
  const mask = await RawImage.fromTensor(maskTensor).resize(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context no disponible");

  const bitmap = await createImageBitmap(shrunk);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const pixelData = ctx.getImageData(0, 0, width, height);
  const alpha = mask.data;
  for (let i = 0; i < alpha.length; i++) {
    pixelData.data[4 * i + 3] = alpha[i];
  }
  ctx.putImageData(pixelData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("Canvas.toBlob falló");
  return new File([blob], "garment-clean.webp", { type: "image/webp" });
}
