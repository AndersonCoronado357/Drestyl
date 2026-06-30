import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate de ubicación: la app entera depende del clima local. Si el usuario
  // todavía no concedió geo, lo mandamos al onboarding antes de que entre.
  const { supabase, user } = await getSessionUser();
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

  // `h-dvh` + main como contenedor flex column → cada página puede usar
  // `flex-1 min-h-0` para llenar el alto exacto y scrollear INTERNO.
  // Padding bottom = altura del BottomNav (h-16 = 64px) + safe-area del
  // iPhone home indicator. Sin el calc(), en iPhones el contenido bajo
  // quedaba tapado por el nav fixed.
  return (
    <div className="flex h-svh flex-col">
      <main
        className="flex w-full flex-1 flex-col overflow-hidden px-5 pt-safe md:px-8 lg:px-12"
        style={{
          paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
