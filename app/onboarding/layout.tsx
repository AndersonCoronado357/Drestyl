export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout vacío para el onboarding — sin bottom nav. La pantalla se
  // encarga de su propio padding y safe-area.
  return <>{children}</>;
}
