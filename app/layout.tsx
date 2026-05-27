import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drestyl",
  description: "Tu clóset, tu outfit del día.",
  applicationName: "Drestyl",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Drestyl",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Limpieza de service workers viejos que cacheaban agresivamente en Fase 0.
// Usamos Next/Script con strategy `afterInteractive` para que NO interfiera
// con la hidratación de React (eso fue lo que rompió todos los handlers
// interactivos en el celular cuando lo puse como script crudo en <head>).
const SW_CLEANUP = `
(function(){
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(rs){
        rs.forEach(function(r){ r.unregister(); });
      });
    }
    if (typeof caches !== 'undefined') {
      caches.keys().then(function(ks){
        ks.forEach(function(k){ caches.delete(k); });
      });
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
        <Script id="sw-cleanup" strategy="afterInteractive">
          {SW_CLEANUP}
        </Script>
      </body>
    </html>
  );
}
