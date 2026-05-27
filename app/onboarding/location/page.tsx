import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocationRequest } from "@/components/onboarding/location-request";

/**
 * Onboarding de ubicación: bloquea el acceso a /(app) hasta que el usuario
 * conceda permiso de geo y guardemos sus coords + ciudad en el profile.
 * Si ya las tiene → redirige a la app directamente.
 */
export default async function OnboardingLocationPage() {
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

  if (profile?.default_lat != null && profile?.default_lng != null) {
    redirect("/");
  }

  return <LocationRequest />;
}
