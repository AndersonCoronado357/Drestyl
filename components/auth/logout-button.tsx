import { logout } from "@/app/actions/auth";

/**
 * Server component. Llama al server action `logout` directamente vía `<form action>`.
 * Sin useTransition ni "use client" porque en móvil el wrapper de transitions a
 * veces se traga el tap. Esta es la forma más confiable.
 */
export function LogoutButton() {
  return (
    <form action={logout} className="w-full">
      <button
        type="submit"
        className="h-12 w-full rounded-xl border border-border bg-background text-base font-medium text-foreground active:scale-[0.99]"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
