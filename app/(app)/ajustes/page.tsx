import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/server/photos";
import { LogoutButton } from "@/components/auth/logout-button";
import { GenderForm } from "@/components/settings/gender-form";
import { ProfileHeader } from "@/components/settings/profile-header";
import { RepeatWindowSlider } from "@/components/settings/repeat-window-slider";
import { StylePreferencesField } from "@/components/settings/style-preferences-field";
import { InstallButton } from "@/components/pwa/install-button";
import { ChangePassword } from "@/components/settings/change-password";
import type { GenderSlug } from "@/lib/gender";
import { isValidGender } from "@/lib/gender";
import { version as appVersion } from "@/package.json";

export default async function AjustesPage() {
  const { supabase, user } = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, gender, repeat_window_days, style_preferences",
    )
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "Tu cuenta");

  const gender: GenderSlug =
    profile && isValidGender(profile.gender) ? profile.gender : "mixto";

  const repeatWindow = Math.min(
    30,
    Math.max(1, profile?.repeat_window_days ?? 10),
  );

  const stylePrefs = profile?.style_preferences ?? "";

  // Inicial del nombre para el avatar — primera letra mayúscula.
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  // Foto de perfil (si la subió); null muestra la inicial.
  const avatarUrl = await getAvatarUrl(user.id);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8">
      {/* Header con avatar + nombre editables in situ */}
      <ProfileHeader
        initialName={displayName}
        avatarUrl={avatarUrl}
        email={user.email ?? ""}
        initial={initial}
      />

      {/* Sección: Preferencias para la IA */}
      <SectionTitle>Cómo te ayudo</SectionTitle>
      <div className="space-y-3">
        <StylePreferencesField initial={stylePrefs} />
        <RepeatWindowSlider initial={repeatWindow} />
      </div>

      {/* Sección: Perfil */}
      <SectionTitle className="mt-8">Tu perfil</SectionTitle>
      <div className="rounded-xl border border-border bg-background p-5">
        <GenderForm initial={gender} />
      </div>

      {/* Sección: App */}
      <SectionTitle className="mt-8">Acceso rápido</SectionTitle>
      <InstallButton />

      {/* Sección: Cuenta */}
      <SectionTitle className="mt-8">Cuenta</SectionTitle>
      <div className="space-y-3">
        <ChangePassword />
        <LogoutButton />
      </div>

      {/* Sección: Créditos */}
      <SectionTitle className="mt-8">Créditos</SectionTitle>
      <div className="rounded-xl border border-border bg-background p-5">
        <ul className="space-y-3 text-sm">
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Clima</span>
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent transition-opacity hover:opacity-70"
            >
              Open-Meteo
            </a>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Ubicación</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent transition-opacity hover:opacity-70"
            >
              OpenStreetMap
            </a>
          </li>
        </ul>
      </div>

      {/* Pie */}
      <p className="mt-10 mb-4 text-center text-[11px] text-muted-foreground">
        Drestyl v{appVersion}
      </p>
    </section>
  );
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}
    >
      {children}
    </p>
  );
}
