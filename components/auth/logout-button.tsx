"use client";

import { useEffect, useState, useTransition } from "react";
import { logout } from "@/app/actions/auth";

/**
 * Cerrar sesión con confirmación de 2-tap (mismo patrón que eliminar
 * prenda). Sin diálogos modales — el botón se transforma 3 segundos.
 */
export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`h-12 w-full rounded-xl text-base font-medium transition-all active:scale-[0.98] ${
          confirming
            ? "bg-destructive text-destructive-foreground hover:opacity-90"
            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
        } ${pending ? "opacity-50" : ""}`}
      >
        {pending
          ? "Cerrando…"
          : confirming
            ? "Confirmar cierre de sesión"
            : "Cerrar sesión"}
      </button>
      {confirming && !pending && (
        <p className="mt-2 text-center text-xs text-muted-foreground animate-fade-in">
          Toca de nuevo para confirmar. Se cancela en 3 segundos.
        </p>
      )}
    </div>
  );
}
