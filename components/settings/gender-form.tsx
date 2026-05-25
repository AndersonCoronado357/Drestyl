"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { GENDERS, type GenderSlug } from "@/lib/gender";
import {
  updateGender,
  type ProfileUpdateState,
} from "@/app/actions/profile";

const SHORT_LABEL: Record<GenderSlug, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  mixto: "Mixto",
};

/**
 * Selector de género en Ajustes con auto-save. Usa radios HTML nativos
 * para el toggle (sin React state que pueda fallar en mobile). El único
 * JS es el onChange que dispara el submit del form al server action.
 *
 * Pill animado fuera del grid para no consumir un slot.
 */
export function GenderForm({ initial }: { initial: GenderSlug }) {
  const [state, formAction, pending] = useActionState<
    ProfileUpdateState,
    FormData
  >(updateGender, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    if (state?.info) {
      setShowInfo(true);
      const t = setTimeout(() => setShowInfo(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="block text-sm font-medium text-foreground">
          ¿Cómo te vistes?
        </p>
        {pending && (
          <span className="text-xs text-muted-foreground">Guardando…</span>
        )}
        {!pending && showInfo && state?.info && (
          <span className="text-xs text-accent">{state.info}</span>
        )}
        {!pending && state?.error && (
          <span className="text-xs text-destructive">{state.error}</span>
        )}
      </div>

      <div className="gender-picker relative">
        <div className="gp-pill" aria-hidden="true" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {GENDERS.map((g) => (
            <label
              key={g.slug}
              className="relative z-10 block h-11 cursor-pointer select-none"
            >
              <input
                type="radio"
                name="gender"
                value={g.slug}
                defaultChecked={g.slug === initial}
                onChange={(e) => {
                  if (e.currentTarget.checked) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium gp-chip">
                {SHORT_LABEL[g.slug]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </form>
  );
}
