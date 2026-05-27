"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  preloadBackgroundModel,
  removeBackgroundAndCompress,
} from "@/lib/image-pipeline";
import { replaceCleanedPhoto } from "@/app/actions/garments";

type Pending = {
  id: string;
  photoUrl: string;
};

type Props = {
  pending: Pending[];
};

/**
 * Procesa en background las prendas con bg_cleaned=false: descarga la foto,
 * le quita el fondo con RMBG-1.4 client-side, y sube la versión limpia al
 * server. Una a la vez para no saturar el CPU. Se ejecuta automáticamente
 * cuando el usuario está en el closet — sin bloquear nada.
 *
 * Si el usuario navega afuera, la cola se interrumpe. Cuando vuelva al
 * closet, retoma desde donde quedó (las prendas no procesadas siguen con
 * bg_cleaned=false).
 *
 * No renderiza nada visible.
 */
export function BgRemovalQueue({ pending }: Props) {
  const router = useRouter();
  const processedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    if (pending.length === 0) return;
    if (runningRef.current) return;
    runningRef.current = true;

    let cancelled = false;

    (async () => {
      console.log(`[bg-queue] ${pending.length} prenda(s) pendientes`);
      await preloadBackgroundModel();
      if (cancelled) return;

      for (const item of pending) {
        if (cancelled) break;
        if (processedRef.current.has(item.id)) continue;
        processedRef.current.add(item.id);

        const shortId = item.id.slice(0, 8);
        try {
          const t0 = performance.now();
          console.log(`[bg-queue] ${shortId} → descargando foto...`);
          const photoRes = await fetch(item.photoUrl);
          if (!photoRes.ok) {
            console.warn(
              `[bg-queue] ${shortId} ✗ descarga falló: ${photoRes.status}`,
            );
            continue;
          }
          const blob = await photoRes.blob();
          const file = new File([blob], "original.webp", { type: blob.type });
          console.log(
            `[bg-queue] ${shortId} → descargada (${(file.size / 1024).toFixed(0)}KB) en ${Math.round(performance.now() - t0)}ms, ahora bg removal...`,
          );

          const tBg = performance.now();
          const cleaned = await removeBackgroundAndCompress(file);
          console.log(
            `[bg-queue] ${shortId} → bg removal listo (${(cleaned.size / 1024).toFixed(0)}KB) en ${Math.round(performance.now() - tBg)}ms, ahora subiendo...`,
          );
          if (cancelled) break;

          const tUp = performance.now();
          const result = await replaceCleanedPhoto(item.id, cleaned);
          if ("error" in result) {
            console.warn(`[bg-queue] ${shortId} ✗ upload falló:`, result.error);
            continue;
          }
          console.log(
            `[bg-queue] ${shortId} ✓ LISTO total ${Math.round(performance.now() - t0)}ms (upload ${Math.round(performance.now() - tUp)}ms)`,
          );
        } catch (err) {
          console.warn(`[bg-queue] ${shortId} ✗ excepción:`, err);
        }
      }

      if (!cancelled) {
        // Refrescar el server component para que las imágenes se vuelvan a
        // pedir con las URLs firmadas nuevas y se vea el resultado limpio.
        router.refresh();
      }
      runningRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [pending, router]);

  return null;
}
