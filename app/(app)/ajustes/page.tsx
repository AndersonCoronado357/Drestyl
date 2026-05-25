import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { GenderForm } from "@/components/settings/gender-form";
import type { GenderSlug } from "@/lib/gender";
import { isValidGender } from "@/lib/gender";

export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, gender")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "Tu cuenta");

  const gender: GenderSlug =
    profile && isValidGender(profile.gender) ? profile.gender : "mixto";

  return (
    <section className="pt-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Ajustes</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </header>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-background p-5">
          <GenderForm initial={gender} />
        </div>

        <LogoutButton />

        <p className="pt-2 text-xs text-muted-foreground">
          Datos meteorológicos por Open-Meteo.
        </p>
      </div>
    </section>
  );
}
