"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Recortador de avatar (portado del de Splitmate, RecorteFoto.svelte):
 * visor circular, zoom con rueda (desktop) o pellizco (táctil), arrastrar para
 * encuadrar, guías de tercios + cruz que aparecen al interactuar. Exporta una
 * imagen cuadrada de 512px (JPEG) vía canvas.
 */

const C = 320; // diámetro del visor (px)
const OUT = 512; // imagen exportada (px)

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function AvatarCropper({
  file,
  onCancel,
  onReady,
}: {
  file: File;
  onCancel: () => void;
  onReady: (f: File) => void;
}) {
  const [url, setUrl] = useState("");
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const [guiaVisible, setGuiaVisible] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const punteros = useRef<{ id: number; x: number; y: number }[]>([]);
  const last = useRef({ x: 0, y: 0 });
  const pinch = useRef({ dist: 0, zoom: 1 });
  const timerGuia = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar la imagen elegida
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    const img = new Image();
    img.onload = () => {
      setW(img.naturalWidth);
      setH(img.naturalHeight);
    };
    img.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Geometría (cover + zoom + pan acotado)
  const coverScale = W && H ? Math.max(C / W, C / H) : 1;
  const drawScale = coverScale * zoom;
  const dispW = W * drawScale;
  const dispH = H * drawScale;
  const halfX = (C - dispW) / 2;
  const halfY = (C - dispH) / 2;
  const panXc = clamp(panX, halfX, -halfX);
  const panYc = clamp(panY, halfY, -halfY);
  const imgLeft = halfX + panXc;
  const imgTop = halfY + panYc;

  const tocarGuia = useCallback(() => {
    setGuiaVisible(true);
    if (timerGuia.current) clearTimeout(timerGuia.current);
    timerGuia.current = setTimeout(() => setGuiaVisible(false), 700);
  }, []);

  // Escape para cerrar
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !procesando) onCancel();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [procesando, onCancel]);

  // Rueda → zoom (listener no-pasivo para poder preventDefault)
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.94 : 1.06;
      setZoom((z) => clamp(z * factor, 1, 3));
      tocarGuia();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [tocarGuia]);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    punteros.current = [
      ...punteros.current,
      { id: e.pointerId, x: e.clientX, y: e.clientY },
    ];
    if (punteros.current.length === 1) {
      last.current = { x: e.clientX, y: e.clientY };
    } else if (punteros.current.length === 2) {
      pinch.current = {
        dist: dist(punteros.current[0], punteros.current[1]),
        zoom,
      };
    }
    tocarGuia();
  }

  function onMove(e: React.PointerEvent) {
    const arr = punteros.current;
    const idx = arr.findIndex((p) => p.id === e.pointerId);
    if (idx === -1) return;
    arr[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (arr.length === 1) {
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      setPanX((p) => clamp(p + dx, halfX, -halfX));
      setPanY((p) => clamp(p + dy, halfY, -halfY));
      last.current = { x: e.clientX, y: e.clientY };
    } else if (arr.length === 2) {
      const d = dist(arr[0], arr[1]);
      if (pinch.current.dist > 0) {
        setZoom(clamp(pinch.current.zoom * (d / pinch.current.dist), 1, 3));
      }
    }
    tocarGuia();
  }

  function onUp(e: React.PointerEvent) {
    punteros.current = punteros.current.filter((p) => p.id !== e.pointerId);
    if (punteros.current.length === 1) {
      last.current = { x: punteros.current[0].x, y: punteros.current[0].y };
    }
    tocarGuia();
  }

  function centrar() {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    tocarGuia();
  }

  async function guardar() {
    setProcesando(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setProcesando(false);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT, OUT);
      const s = OUT / C;
      ctx.drawImage(img, imgLeft * s, imgTop * s, dispW * s, dispH * s);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setProcesando(false);
            return;
          }
          onReady(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.9,
      );
    } catch {
      setProcesando(false);
    }
  }

  const sinCambios = zoom === 1 && panX === 0 && panY === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar foto de perfil"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Ajusta tu foto
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Arrastra para encuadrar · rueda o pellizca para zoom
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={procesando}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Visor circular */}
        <div className="flex flex-col items-center gap-3 bg-muted/40 px-6 py-6">
          <div
            ref={viewerRef}
            className={`relative touch-none select-none overflow-hidden rounded-full bg-muted ring-1 ring-black/10 ${
              punteros.current.length > 0 ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ width: C, height: C, maxWidth: "100%", aspectRatio: 1 }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ width: dispW, height: dispH, left: imgLeft, top: imgTop }}
              />
            )}

            {/* Guías: tercios + cruz, visibles al interactuar */}
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                guiaVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="absolute bottom-0 left-1/3 top-0 w-px bg-white/45" />
              <div className="absolute bottom-0 left-2/3 top-0 w-px bg-white/45" />
              <div className="absolute left-0 right-0 top-1/3 h-px bg-white/45" />
              <div className="absolute left-0 right-0 top-2/3 h-px bg-white/45" />
              <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2">
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70" />
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/70" />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15" />
          </div>

          <button
            type="button"
            onClick={centrar}
            disabled={sinCambios}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Centrar
          </button>
        </div>

        {/* Acciones */}
        <footer className="flex gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={procesando}
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={procesando || !W}
            className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {procesando ? (
              <>
                <span className="block size-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
                Guardando…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Usar foto
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
