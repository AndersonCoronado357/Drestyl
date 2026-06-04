import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { TodayView } from "@/components/today/today-view";

export default async function HoyPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [profileRes, countRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("garments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  const displayName =
    profileRes.data?.display_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "tú");

  const activeGarments = countRes.count ?? 0;

  return <TodayView displayName={displayName} activeGarments={activeGarments} />;
}
