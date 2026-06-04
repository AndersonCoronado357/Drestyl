"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  login,
  signInWithGoogle,
  signup,
  type AuthState,
} from "@/app/actions/auth";
import { GoogleIcon } from "./google-icon";
import { PasswordInput } from "./password-input";
import { GenderPicker } from "./gender-picker";

type Mode = "login" | "signup";

const inputClass =
  "w-full rounded-xl border border-transparent bg-accent/8 px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60";

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  const title = mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta";
  const subtitle =
    mode === "login" ? "Entra para ver tu outfit de hoy." : null;
  const submitLabel = mode === "login" ? "Entrar" : "Crear cuenta";
  const altHref = mode === "login" ? "/signup" : "/login";
  const altPrefix =
    mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?";
  const altLink = mode === "login" ? "Crear una" : "Iniciar sesión";

  // Cada bloque entra con un retraso escalonado: stagger de 70ms.
  // Usamos `key={mode}` en los wrappers para que React vuelva a montar
  // los nodos al cambiar entre login/signup y se vuelva a animar.
  return (
    <div className="w-full" key={mode}>
      {/* Logo / nombre — solo en móvil; en desktop está en el panel lateral */}
      <div
        className="mb-5 flex animate-fade-up justify-center lg:hidden"
        style={{ animationDelay: "0ms" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo-text.png" alt="Drestyl" className="h-8 w-auto" />
      </div>

      <header
        className="mb-4 animate-fade-up"
        style={{ animationDelay: "70ms" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </header>

      <form
        action={formAction}
        className="animate-fade-up space-y-3"
        style={{ animationDelay: "140ms" }}
      >
        {mode === "signup" && (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor="display_name"
                className="block text-sm font-medium text-foreground"
              >
                Tu nombre
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                autoComplete="name"
                placeholder="Cómo te llamas"
                className={inputClass}
              />
            </div>

            <GenderPicker name="gender" />
          </>
        )}

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
            autoComplete="email"
            inputMode="email"
            required
            placeholder="tu@correo.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Contraseña
            </label>
            {mode === "login" && (
              <Link
                href="/recuperar"
                className="text-xs font-medium text-accent"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "signup" ? 8 : undefined}
            placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "••••••••"}
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
          className="mt-0.5 h-11 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Un momento…" : submitLabel}
        </button>
      </form>

      {/* Separador "o" */}
      <div
        className="my-3 flex animate-fade-up items-center gap-3"
        style={{ animationDelay: "210ms" }}
      >
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          o
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Social login con Google */}
      <form
        action={signInWithGoogle}
        className="animate-fade-up"
        style={{ animationDelay: "280ms" }}
      >
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-base font-medium text-foreground transition-transform active:scale-[0.99]"
        >
          <GoogleIcon />
          Continuar con Google
        </button>
      </form>

      <p
        className="mt-4 animate-fade-up text-center text-sm text-muted-foreground"
        style={{ animationDelay: "350ms" }}
      >
        {altPrefix}{" "}
        <Link href={altHref} className="font-medium text-accent">
          {altLink}
        </Link>
      </p>
    </div>
  );
}
