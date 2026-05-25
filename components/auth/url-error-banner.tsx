"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ErrorInfo = {
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
};

/**
 * Lee errores en la URL al cargar /login y muestra un banner claro al
 * usuario. Cubre dos fuentes:
 *
 * - Query string `?oauth=...` — lo ponemos nosotros desde /auth/callback
 *   cuando el flow de Google falla.
 * - Hash `#error_code=...` — lo pone Supabase cuando el link de
 *   recuperación de contraseña expira (otp_expired) o el usuario lo abre
 *   tras haberlo usado (access_denied).
 *
 * Después de mostrar, limpia la URL para que el banner no reaparezca al
 * refrescar la página.
 */
export function UrlErrorBanner() {
  const [info, setInfo] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");

    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const hashParams = new URLSearchParams(rawHash);
    const errorCode = hashParams.get("error_code");

    let next: ErrorInfo | null = null;

    if (errorCode === "otp_expired") {
      next = {
        message: "El enlace para cambiar tu contraseña ya expiró.",
        ctaHref: "/recuperar",
        ctaLabel: "Pedir otro",
      };
    } else if (errorCode === "access_denied") {
      next = {
        message: "El enlace no es válido o ya fue usado.",
        ctaHref: "/recuperar",
        ctaLabel: "Pedir otro",
      };
    } else if (
      oauth === "missing_code" ||
      oauth === "exchange_failed" ||
      oauth === "error"
    ) {
      next = {
        message:
          "Hubo un problema al iniciar sesión. Intenta de nuevo o usa tu correo.",
      };
    }

    if (next) {
      setInfo(next);
      // Limpia la URL: quita query y hash, deja solo el pathname.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!info) return null;

  return (
    <div
      role="alert"
      className="mb-5 animate-fade-up rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {info.message}
      {info.ctaHref && info.ctaLabel && (
        <>
          {" "}
          <Link
            href={info.ctaHref}
            className="font-semibold underline underline-offset-2"
          >
            {info.ctaLabel}
          </Link>
          .
        </>
      )}
    </div>
  );
}
