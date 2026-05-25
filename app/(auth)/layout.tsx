"use client";

import { usePathname } from "next/navigation";
import { DecorPanel } from "@/components/auth/decor-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSignup = pathname.startsWith("/signup");
  const mode = isSignup ? "signup" : "login";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/*
        Columna del formulario.
        - Móvil: ocupa toda la pantalla, centrado.
        - Desktop (lg+): mitad izquierda en login, se desliza a la mitad derecha
          en signup gracias al transform.
      */}
      <div
        className={`flex min-h-dvh items-center justify-center px-6 py-6 lg:absolute lg:inset-y-0 lg:left-0 lg:w-1/2 lg:px-12 lg:py-12 lg:transition-transform lg:duration-[800ms] lg:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          isSignup ? "lg:translate-x-full" : ""
        }`}
      >
        <div className="w-full max-w-sm sm:max-w-md">{children}</div>
      </div>

      {/*
        Panel decorativo lateral.
        - Móvil: oculto.
        - Desktop (lg+): mitad derecha en login, se desliza a la mitad izquierda
          en signup. El form y el panel cruzan posiciones al cambiar de modo.
      */}
      <aside
        aria-hidden="true"
        className={`hidden lg:absolute lg:inset-y-0 lg:right-0 lg:flex lg:w-1/2 lg:transition-transform lg:duration-[800ms] lg:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          isSignup ? "lg:-translate-x-full" : ""
        }`}
      >
        <DecorPanel mode={mode} />
      </aside>
    </div>
  );
}
