"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthState } from "@/app/actions/auth";
import { PasswordInput } from "./password-input";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
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
          Crea una nueva contraseña
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Esta será tu nueva contraseña para entrar a Drestyl.
        </p>
      </header>

      <form
        action={formAction}
        className="animate-fade-up space-y-3.5"
        style={{ animationDelay: "140ms" }}
      >
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Nueva contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password_confirm"
            className="block text-sm font-medium text-foreground"
          >
            Repítela
          </label>
          <PasswordInput
            id="password_confirm"
            name="password_confirm"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
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

        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar contraseña"}
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
