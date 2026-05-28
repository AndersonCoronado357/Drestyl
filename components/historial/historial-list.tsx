import Link from "next/link";
import { getCategoryLabel } from "@/lib/categories";
import type { Garment } from "@/lib/garments";

type HistorialOutfit = {
  id: string;
  wornDate: string; // YYYY-MM-DD
  garmentIds: string[];
  occasion: string | null;
  reasoning: string | null;
  source: "ai_suggested" | "user_edited" | "fallback";
};

type Props = {
  outfits: HistorialOutfit[];
  garmentsById: Record<string, Garment>;
  photoUrls: Record<string, string>;
};

/**
 * Historial compacto — una fila chica por outfit con thumbnails apilados.
 * Tap a la fila → /historial/[id] con la vista detallada.
 *
 * Solo lectura. El historial se alimenta cuando el usuario toca "Usar" en
 * /sugerencia, no se edita ni se borra desde acá.
 */
export function HistorialList({ outfits, garmentsById, photoUrls }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-8">
      <header className="mb-6 shrink-0">
        <p className="text-sm text-muted-foreground">Historial</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Lo que has usado
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {outfits.length === 0
            ? "Tu primer outfit aceptado va a aparecer acá"
            : outfits.length === 1
              ? "1 outfit registrado"
              : `${outfits.length} outfits registrados`}
        </p>
      </header>

      {outfits.length === 0 ? (
        <EmptyHistorial />
      ) : (
        <div className="space-y-2 pb-4">
          {outfits.map((o) => (
            <HistorialRow
              key={o.id}
              outfit={o}
              garmentsById={garmentsById}
              photoUrls={photoUrls}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HistorialRow({
  outfit,
  garmentsById,
  photoUrls,
}: {
  outfit: HistorialOutfit;
  garmentsById: Record<string, Garment>;
  photoUrls: Record<string, string>;
}) {
  const garments = outfit.garmentIds
    .map((id) => garmentsById[id])
    .filter((g): g is Garment => g !== undefined);

  // Mostramos hasta 4 thumbnails; si hay más, mostramos un "+N" al final.
  const THUMBS = 4;
  const visible = garments.slice(0, THUMBS);
  const extra = Math.max(0, garments.length - THUMBS);

  const dateLabel = formatDateLabel(outfit.wornDate);
  const subtitle = outfit.occasion?.trim() || dateLabel.absolute;

  return (
    <Link
      href={`/historial/${outfit.id}`}
      className="group flex items-center gap-3 rounded-2xl bg-accent/8 p-3 transition-colors hover:bg-accent/12 active:scale-[0.99]"
    >
      {/* Stack de thumbs apilados horizontalmente con leve overlap */}
      <div className="flex shrink-0 -space-x-2">
        {visible.length === 0 ? (
          <div className="grid size-12 place-items-center rounded-xl bg-background text-[10px] text-muted-foreground">
            —
          </div>
        ) : (
          visible.map((g) => {
            const url = photoUrls[g.id];
            const label = g.name?.trim() || getCategoryLabel(g.category);
            return (
              <div
                key={g.id}
                className="relative size-12 overflow-hidden rounded-xl bg-background ring-2 ring-accent/8"
                title={label}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={label}
                    className="size-full object-contain"
                    loading="lazy"
                  />
                ) : null}
              </div>
            );
          })
        )}
        {extra > 0 && (
          <div className="grid size-12 place-items-center rounded-xl bg-accent/20 text-xs font-semibold text-accent ring-2 ring-accent/8">
            +{extra}
          </div>
        )}
      </div>

      {/* Fecha + ocasión + chevron */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {dateLabel.relative}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {outfit.source !== "ai_suggested" && (
        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
          {outfit.source === "user_edited" ? "Editado" : "Sin IA"}
        </span>
      )}

      <ChevronRight />
    </Link>
  );
}

function EmptyHistorial() {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-accent/12 text-accent">
        <ClockIcon />
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
        Aún no hay nada acá
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Genera un outfit en Hoy, toca <span className="font-medium">Usar</span>{" "}
        y se va a registrar como tu look del día.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground active:scale-[0.99]"
      >
        Ir a Hoy
      </Link>
    </div>
  );
}

function formatDateLabel(wornDate: string): {
  relative: string;
  absolute: string;
} {
  const today = todayLocalDateStr();
  const days = daysBetween(wornDate, today);
  let relative: string;
  if (days === 0) relative = "Hoy";
  else if (days === 1) relative = "Ayer";
  else if (days < 7) relative = `Hace ${days} días`;
  else if (days < 14) relative = "La semana pasada";
  else if (days < 30) relative = `Hace ${Math.floor(days / 7)} semanas`;
  else relative = `Hace ${Math.floor(days / 30)} meses`;

  const [y, m, d] = wornDate.split("-").map((p) => parseInt(p, 10));
  const dt = new Date(y, m - 1, d);
  const absolute = dt.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return { relative, absolute };
}

function todayLocalDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map((p) => parseInt(p, 10));
  const [by, bm, bd] = b.split("-").map((p) => parseInt(p, 10));
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.abs(Math.round((db - da) / 86_400_000));
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
