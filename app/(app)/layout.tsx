import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="w-full flex-1 px-5 pb-32 pt-safe md:px-8 lg:px-12">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
