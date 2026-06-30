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
    // "standalone": al agregar a la pantalla de inicio se abre como una app
    // (sin barra del navegador), como Splitmate. El layout ya maneja el área
    // segura del aparato (viewportFit "cover" + pb-safe en la barra inferior),
    // así que no se rompe con el notch ni la barra del home.
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAFA",
    theme_color: "#FAFAFA",
    lang: "es-CO",
    dir: "ltr",
    categories: ["lifestyle", "personalization", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
