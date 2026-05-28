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
    startupImage: ["/icons/apple-touch-icon.png"],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Registro del service worker. Es lo que habilita la "instalabilidad" en
// Chrome/Edge — junto al manifest + íconos válidos cumple los criterios.
// strategy="afterInteractive" garantiza que NO bloquee la hidratación de
// React (eso rompió cosas en versiones anteriores cuando el SW se cargaba
// inline en el head).
const SW_REGISTER = `
(function(){
  if (!('serviceWorker' in navigator)) return;
  try {
    navigator.serviceWorker.register('/sw.js').catch(function(err){
      console.warn('[sw] register failed:', err);
    });
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
        <Script id="sw-register" strategy="afterInteractive">
          {SW_REGISTER}
        </Script>
      </body>
    </html>
  );
}
