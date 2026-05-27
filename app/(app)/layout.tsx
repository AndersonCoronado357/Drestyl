import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate de ubicación: la app entera depende del clima local. Si el usuario
  // todavía no concedió geo, lo mandamos al onboarding antes de que entre.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_lat, default_lng")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.default_lat == null || profile?.default_lng == null) {
    redirect("/onboarding/location");
  }

  // `h-dvh` (no min-h) + main como contenedor flex column → cada página
  // puede usar `flex-1 min-h-0` para llenar el alto exacto y scrollear
  // INTERNO en vez de a nivel de página. `pb-20` reserva el alto del
  // BottomNav fixed (h-16 = 64px + pb-safe ≈ 80px). `overflow-hidden`
  // mata cualquier scroll a nivel main por si una página rebalsa.
  return (
    <div className="flex h-dvh flex-col">
      <main className="flex w-full flex-1 flex-col overflow-hidden px-5 pb-20 pt-safe md:px-8 lg:px-12">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
