"use client";

import { useEffect, useRef, useState } from "react";
import { updateStylePreferences } from "@/app/actions/profile";

const MAX_LEN = 500;

/**
 * Textarea con autosave (debounce 800ms) para las preferencias de estilo.
 * Va al prompt de Gemini cuando arma outfits — por eso vale la pena que
 * sea texto libre, no chips: el usuario puede decir cosas matizadas.
 */
export function StylePreferencesField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef(initial);

  useEffect(() => {
    if (value === lastSavedRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    setStatus("saving");
    saveTimerRef.current = window.setTimeout(async () => {
      const result = await updateStylePreferences(value);
      if ("ok" in result) {
        lastSavedRef.current = value;
        setStatus("saved");
        setErrorMsg(null);
        window.setTimeout(() => {
          setStatus((s) => (s === "saved" ? "idle" : s));
        }, 1500);
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [value]);

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="text-sm font-semibold text-foreground">
        Cómo te gusta vestirte
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Texto libre que la IA tiene en cuenta al armar tus outfits.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        rows={4}
        placeholder="Ej: Me gusta el estilo casual urbano, prefiero colores neutros, evito ropa muy formal."
        className="mt-3 w-full resize-none rounded-xl bg-accent/8 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-accent/12"
      />
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {value.length}/{MAX_LEN}
        </span>
        <span>
          {status === "saving" && (
            <span className="text-muted-foreground">Guardando…</span>
          )}
          {status === "saved" && (
            <span className="text-accent">✓ Guardado</span>
          )}
          {status === "error" && (
            <span className="text-destructive">{errorMsg}</span>
          )}
        </span>
      </div>
    </div>
  );
}
