"use client";

import { useEffect, useRef, useState } from "react";
import { updateRepeatWindow } from "@/app/actions/profile";

const MIN = 1;
const MAX = 30;

/**
 * Slider 1-30 días para configurar la "ventana de no repetir prendas".
 *
 * Look: track lila claro + relleno lila sólido + thumb circular. El valor
 * actual aparece arriba del thumb en una etiqueta flotante. Min/max abajo.
 *
 * Persistencia: autosave con debounce (500ms después del último cambio).
 * No hay botón "Guardar" — la sensación es directa, como un slider de
 * volumen del sistema.
 */
export function RepeatWindowSlider({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedRef = useRef(initial);

  // Debounce: cada cambio reinicia el timer. Después de 500ms sin cambios,
  // dispara la action. Evita escribir en DB en cada arrastre del slider.
  useEffect(() => {
    if (value === lastSavedRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    setStatus("saving");
    saveTimerRef.current = window.setTimeout(async () => {
      const result = await updateRepeatWindow(value);
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
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [value]);

  const pct = ((value - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            No repetir prendas
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            La IA evita prendas usadas en los últimos X días
          </p>
        </div>
        {/* Ancho fijo para que no salte el layout al pasar de 1 a 2 dígitos
            ni de "día" a "días". w-12 ≈ 48px cubre "30" en text-2xl + "días". */}
        <div className="w-12 shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {value === 1 ? "día" : "días"}
          </p>
        </div>
      </div>

      {/* Track + relleno + thumb. Usamos input[type="range"] real para a11y +
          touch nativo, pero le ocultamos el look del browser. La pista
          visual la pintamos con un div absoluto debajo. */}
      <div className="relative h-6">
        <div className="absolute inset-y-0 left-0 right-0 my-auto h-2 rounded-full bg-accent/15" />
        <div
          className="absolute inset-y-0 left-0 my-auto h-2 rounded-full bg-accent transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Días para no repetir prendas"
          className="repeat-window-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{MIN} día</span>
        <span>{MAX} días</span>
      </div>

      <div className="mt-3 h-4 text-center text-[11px]">
        {status === "saving" && (
          <span className="text-muted-foreground">Guardando…</span>
        )}
        {status === "saved" && (
          <span className="text-accent">✓ Guardado</span>
        )}
        {status === "error" && (
          <span className="text-destructive">{errorMsg}</span>
        )}
      </div>
    </div>
  );
}
