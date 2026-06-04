"use client";

import { useActionState, useEffect, useState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { changePassword, type AuthState } from "@/app/actions/auth";

/**
 * Card de "Cambiar contraseña" en Ajustes. Sin modal — es un botón que
 * expande un formulario inline. Pide la contraseña actual + la nueva
 * (dos veces). El server verifica la actual antes de cambiar.
 *
 * Al guardar con éxito, colapsa el form y muestra "Contraseña actualizada"
 * por unos segundos.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    changePassword,
    undefined,
  );
  const [justSaved, setJustSaved] = useState(false);

  // Cuando el server confirma, colapsamos y mostramos el éxito un rato.
  useEffect(() => {
    if (state?.info) {
      setOpen(false);
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <KeyIcon />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Cambiar contraseña
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {justSaved ? "✓ Contraseña actualizada" : "Actualiza tu clave de acceso"}
            </p>
          </div>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <form action={formAction} className="mt-4 space-y-3 animate-fade-in">
          <div>
            <label
              htmlFor="current_password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Contraseña actual
            </label>
            <PasswordInput
              id="current_password"
              name="current_password"
              autoComplete="current-password"
              required
              size="sm"
              placeholder="Tu contraseña actual"
            />
          </div>
          <div>
            <label
              htmlFor="new_password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Contraseña nueva
            </label>
            <PasswordInput
              id="new_password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              size="sm"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label
              htmlFor="confirm_password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Repetir contraseña nueva
            </label>
            <PasswordInput
              id="confirm_password"
              name="password_confirm"
              autoComplete="new-password"
              required
              minLength={8}
              size="sm"
              placeholder="Confirma la nueva contraseña"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="h-11 flex-1 rounded-xl bg-accent/8 text-sm font-medium text-foreground transition-colors hover:bg-accent/15 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function KeyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2M16 7l3 3M14 9l2 2" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
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
      className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
