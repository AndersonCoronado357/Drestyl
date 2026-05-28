"use client";

import { useEffect, useState } from "react";

type Mode = "loading" | "chromium" | "firefox" | "safari" | "ios" | "android";

/**
 * Card de Ajustes con instrucciones para crear un acceso directo a Drestyl
 * en el dispositivo del usuario. No instala la app como aplicación
 * standalone — la idea es solo un atajo que abre Drestyl como una pestaña
 * normal del navegador.
 *
 * Detecta el navegador y el sistema operativo para mostrar los pasos
 * apropiados.
 */
export function InstallButton() {
  const [mode, setMode] = useState<Mode>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroid = /Android/.test(ua);
    const isFirefox = /Firefox|FxiOS/.test(ua);
    const isSafariDesktop =
      !isIOS && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIOS) setMode("ios");
    else if (isAndroid) setMode("android");
    else if (isFirefox) setMode("firefox");
    else if (isSafariDesktop) setMode("safari");
    else setMode("chromium");
  }, []);

  if (mode === "loading") {
    return (
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-center gap-3">
          <div className="size-9 animate-pulse rounded-xl bg-accent/15" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-accent/15" />
            <div className="h-2.5 w-48 animate-pulse rounded bg-accent/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <LinkIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Acceso directo
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Abre Drestyl rápido desde tu pantalla de inicio o escritorio.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-accent/8 px-4 py-3 text-xs leading-relaxed text-foreground">
        <InstructionsFor mode={mode} />
      </div>
    </div>
  );
}

function InstructionsFor({ mode }: { mode: Mode }) {
  if (mode === "ios") {
    return (
      <ol className="space-y-1.5">
        <Step
          n={1}
          text={
            <>
              Toca el botón de compartir{" "}
              <span className="inline-flex translate-y-[2px]">
                <ShareIcon />
              </span>{" "}
              en la barra inferior de Safari.
            </>
          }
        />
        <Step n={2} text={<>Selecciona la opción “Agregar a pantalla de inicio”.</>} />
        <Step n={3} text={<>Confirma con el botón “Agregar” en la esquina superior derecha.</>} />
      </ol>
    );
  }

  if (mode === "android") {
    return (
      <ol className="space-y-1.5">
        <Step n={1} text={<>Abre el menú del navegador (los tres puntos arriba a la derecha).</>} />
        <Step n={2} text={<>Selecciona “Agregar a pantalla de inicio” o “Añadir a Home”.</>} />
        <Step n={3} text={<>Confirma con “Agregar”.</>} />
      </ol>
    );
  }

  if (mode === "firefox") {
    return (
      <p>
        Arrastra el ícono que aparece a la izquierda de la barra de
        direcciones hasta el escritorio.
      </p>
    );
  }

  if (mode === "safari") {
    return (
      <p>
        Arrastra la dirección desde la barra superior hasta el escritorio
        de tu Mac.
      </p>
    );
  }

  // Chromium (Chrome, Edge, Brave, Opera)
  return (
    <ol className="space-y-1.5">
      <Step n={1} text={<>Abre el menú del navegador (los tres puntos arriba a la derecha).</>} />
      <Step
        n={2}
        text={
          <>
            Entra en “Más herramientas” y luego en “Crear acceso directo”.
          </>
        }
      />
      <Step
        n={3}
        text={
          <>
            Confirma con “Crear” dejando sin marcar la opción “Abrir como
            ventana”.
          </>
        }
      />
    </ol>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
        {n}
      </span>
      <span className="flex-1">{text}</span>
    </li>
  );
}

function LinkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
