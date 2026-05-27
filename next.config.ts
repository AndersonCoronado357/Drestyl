import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 15+ bloquea por seguridad peticiones de dev desde orígenes que no
  // sean localhost. Sin esto, al abrir desde el celular en LAN React no
  // hidrata. Lista todos los hosts desde los que vas a probar en dev.
  allowedDevOrigins: ["192.168.1.5", "192.168.1.*", "localhost"],
  // lightningcss (usado por @tailwindcss/postcss) tiene un native addon
  // (.node) que Turbopack no bundle bien — rompe el require relativo del
  // binario. Marcarlo external hace que Node lo cargue normalmente.
  serverExternalPackages: ["lightningcss", "@tailwindcss/postcss"],
  experimental: {
    serverActions: {
      // Las fotos del celular típicamente pesan 2-5MB. 10MB nos da margen
      // hasta que en el siguiente bloque agreguemos compresión en cliente.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
