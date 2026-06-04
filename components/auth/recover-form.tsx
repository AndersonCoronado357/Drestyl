"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type AuthState,
} from "@/app/actions/auth";

const inputClass =
  "w-full rounded-xl border border-transparent bg-accent/8 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60";

export function RecoverForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <div className="w-full">
      <div
        className="mb-5 flex animate-fade-up justify-center lg:hidden"
        style={{ animationDelay: "0ms" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo-text.png" alt="Drestyl" className="h-8 w-auto" />
      </div>

      <header
        className="mb-6 animate-fade-up"
        style={{ animationDelay: "70ms" }}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Te enviaremos un enlace a tu correo para que vuelvas a entrar.
        </p>
      </header>

      <form
        action={formAction}
        className="animate-fade-up space-y-3.5"
        style={{ animationDelay: "140ms" }}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="tu@correo.com"
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="animate-fade-up rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        {state?.info && (
          <p
            role="status"
            className="animate-fade-up rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-foreground"
          >
            {state.info}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>

      <p
        className="mt-6 animate-fade-up text-center text-sm text-muted-foreground"
        style={{ animationDelay: "210ms" }}
      >
        <Link href="/login" className="font-medium text-accent">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
