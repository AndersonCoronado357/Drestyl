import type { CSSProperties } from "react";

type Mode = "login" | "signup";
type Shape = "shirt" | "pants" | "jacket" | "shoe";

type IconSpec = {
  left: string;
  top: string;
  size: number;
  opacity: number;
  delay: number;
  shape: Shape;
};

const ANIM_DURATION_S = 32;
const ICON_COLS = 6;
const ICON_ROWS = 8;
const SHAPES: Shape[] = ["shirt", "pants", "jacket", "shoe"];

// Grid pseudo-aleatorio: 6×8 = 48 íconos. Las posiciones se distribuyen
// de -10% a 110% para que siempre haya íconos entrando por SW y saliendo
// por NE. La fase del cycle (delay) se descorrelaciona de la posición con
// una permutación (i*23 mod 48) — sin esto, íconos vecinos en el grid
// tenían fases vecinas en el cycle y se veían como una banda que avanza.
// Con descorrelación, en cualquier instante hay íconos repartidos por
// todo el panel en distintas fases.
const FLOATING_ICONS: IconSpec[] = (() => {
  const list: IconSpec[] = [];
  const total = ICON_COLS * ICON_ROWS; // 48
  const SHUFFLE = 23; // primo coprimo con 48 → permutación completa
  const SPAN = 120;
  const OFFSET = -10;
  for (let r = 0; r < ICON_ROWS; r++) {
    for (let c = 0; c < ICON_COLS; c++) {
      const i = r * ICON_COLS + c;
      const baseLeft = OFFSET + (c + 0.5) * (SPAN / ICON_COLS);
      const baseTop = OFFSET + (r + 0.5) * (SPAN / ICON_ROWS);
      const jitterX = (((i * 7919) % 100) / 100) * 10 - 5;
      const jitterY = (((i * 1297) % 100) / 100) * 10 - 5;
      // Fase de este ícono en el cycle: descorrelacionada de su posición.
      const phaseIdx = (i * SHUFFLE) % total;
      list.push({
        left: `${baseLeft + jitterX}%`,
        top: `${baseTop + jitterY}%`,
        size: 5 + (i % 3),
        opacity: 0.18 + (i % 3) * 0.04,
        delay: -((phaseIdx / total) * ANIM_DURATION_S),
        shape: SHAPES[i % SHAPES.length],
      });
    }
  }
  return list;
})();

const CONTENT: Record<Mode, { title: [string, string]; body: string }> = {
  login: {
    title: ["Tu clóset,", "tu outfit del día."],
    body: "Drestyl te arma combinaciones con lo que ya tienes, según el clima y lo que vas a hacer.",
  },
  signup: {
    title: ["Vístete sin pensarlo,", "todos los días."],
    body: "Sube tu ropa una vez. Cada mañana recibe un outfit pensado para el clima y tu plan, sin repetir.",
  },
};

/**
 * Panel decorativo lateral que se ve solo en pantallas grandes (lg+).
 *
 * - Fondo: color sólido lila + una "lluvia" de íconos pequeños cruzando en
 *   diagonal (esquina inferior-izquierda → superior-derecha) en bucle
 *   continuo. Cada uno tiene su propio delay para que el flujo nunca se
 *   detenga.
 * - Contenido central: ícono grande + frase + descripción. El bloque se
 *   re-monta cuando cambia `mode` (gracias al `key`) para que la cascada
 *   de entrada se vuelva a reproducir.
 */
export function DecorPanel({ mode }: { mode: Mode }) {
  const { title, body } = CONTENT[mode];

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-accent p-12 text-accent-foreground">
      {/* Capa de íconos en lluvia diagonal */}
      <div className="pointer-events-none absolute inset-0">
        {FLOATING_ICONS.map((icon, i) => (
          <DecorIcon key={i} spec={icon} />
        ))}
      </div>

      {/* Contenido central — re-monta al cambiar mode para reanimar */}
      <div key={mode} className="relative z-10 mx-auto max-w-md text-center">
        <div
          className="mx-auto mb-8 flex animate-fade-up items-center justify-center"
          style={{ animationDelay: "100ms" }}
        >
          {/* Logo D-camiseta grande, sin recuadro, en blanco sobre el morado */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo.png"
            alt=""
            className="h-32 w-auto brightness-0 invert"
            aria-hidden
          />
        </div>

        <p
          className="mb-3 animate-fade-up text-3xl font-semibold leading-tight tracking-tight"
          style={{ animationDelay: "200ms" }}
        >
          {title[0]}
          <br />
          {title[1]}
        </p>
        <p
          className="animate-fade-up text-base text-accent-foreground/80"
          style={{ animationDelay: "300ms" }}
        >
          {body}
        </p>
      </div>

      {/* Marca abajo — logo en blanco sobre el panel morado */}
      <div
        className="absolute bottom-8 left-12 z-10 animate-fade-up"
        style={{ animationDelay: "400ms" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/logo-text.png"
          alt="Drestyl"
          className="h-7 w-auto brightness-0 invert"
        />
      </div>
    </div>
  );
}

function DecorIcon({ spec }: { spec: IconSpec }) {
  const sizeClass =
    ({
      4: "size-4",
      5: "size-5",
      6: "size-6",
      7: "size-7",
      8: "size-8",
    } as const)[spec.size as 4 | 5 | 6 | 7 | 8] ?? "size-6";

  const paths: Record<Shape, React.ReactNode> = {
    shirt: (
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z" />
    ),
    pants: <path d="M6 2h12l-1 8 1 12h-5l-1-10-1 10H6l1-12-1-8z" />,
    jacket: <path d="M16 2H8L4 5l1 4h2v13h10V9h2l1-4-4-3zm-4 6V3" />,
    shoe: <path d="M2 16h6l2-2 4 1 4 1 4 4H2v-4zM8 12V8h3l2 4" />,
  };

  // CSS variable que el keyframe lee para la opacidad máxima por ícono.
  const style: CSSProperties & Record<"--icon-opacity", string> = {
    left: spec.left,
    top: spec.top,
    animationDelay: `${spec.delay}s`,
    "--icon-opacity": String(spec.opacity),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={`icon-rain absolute ${sizeClass}`}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[spec.shape]}
    </svg>
  );
}
