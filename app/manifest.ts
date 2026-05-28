import type { MetadataRoute } from "next";

/**
 * Manifest del PWA. Next App Router lo expone en /manifest.webmanifest
 * automáticamente y lo enlaza desde metadata.manifest del layout.
 *
 * Icons: PNG generados con sharp a partir del SVG base (scripts/generate-
 * icons.mjs). Necesitamos PNGs porque Chrome no acepta SVG para los
 * criterios de "installable PWA".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drestyl",
    short_name: "Drestyl",
    description:
      "Tu clóset y tu outfit del día, armado con IA según el clima.",
    start_url: "/",
    scope: "/",
    // "browser" en vez de "standalone": al "instalar" desde el browser,
    // crea un acceso directo que abre la app como una pestaña normal,
    // NO como ventana standalone separada. Evita que el layout se vea
    // diferente cuando está "instalada".
    display: "browser",
    orientation: "portrait",
    background_color: "#FAFAFA",
    theme_color: "#FAFAFA",
    lang: "es-CO",
    dir: "ltr",
    categories: ["lifestyle", "personalization", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
