"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import {
  deleteGarment,
  updateGarment,
  type GarmentMutationState,
} from "@/app/actions/garments";
import { TshirtLoader } from "@/components/ui/tshirt-loader";
import type { Garment, Formality, Climate } from "@/lib/garments";

const FORMALITY_OPTS: Formality[] = ["formal", "elegante", "casual", "deportivo"];
const CLIMATE_OPTS: Climate[] = ["frio", "templado", "calor", "mixto"];

function formalityLabel(f: Formality) {
  return { formal: "Formal", elegante: "Elegante", casual: "Casual", deportivo: "Deportivo" }[f];
}
function climateLabel(c: Climate) {
  return { frio: "Clima frío", templado: "Templado", calor: "Calor", mixto: "Cualquier clima" }[c];
}

type Props = {
  garments: Garment[];
  photoUrls: Record<string, string | null>;
  initialId: string;
  /** Si se pasa, "Volver" llama esta callback (sin URL change). Si no,
      hace router.push("/closet"). */
  onBack?: () => void;
  /** Label del filtro activo (ej. "Prenda superior") — se muestra junto
      al contador X/Y para dar contexto de qué set estás recorriendo. */
  contextLabel?: string;
};

/**
 * Vista detallada con navegación 100% client-side: prev/next NO cambia
 * la URL ni hace fetch al servidor. Toda la data del closet está en memoria
 * desde el padre — navegar es solo `setIdx(...)`.
 */
export function GarmentDetail({
  garments,
  photoUrls,
  initialId,
  onBack,
  contextLabel,
}: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(() =>
    Math.max(
      0,
      garments.findIndex((g) => g.id === initialId),
    ),
  );
  const current = garments[idx];

  // Estado del form — controlado, se resetea cuando cambia la prenda
  const [name, setName] = useState(current?.name ?? "");
  const [category, setCategory] = useState<CategorySlug>(current?.category);
  const [active, setActive] = useState(current?.is_active ?? true);
  const [formality, setFormality] = useState<Formality | null>(
    current?.formality ?? null,
  );
  const [climate, setClimate] = useState<Climate | null>(
    current?.climate ?? null,
  );

  // Cuando cambia idx, reseteamos el form a los valores de la nueva prenda.
  useEffect(() => {
    if (!current) return;
    setName(current.name ?? "");
    setCategory(current.category);
    setActive(current.is_active);
    setFormality(current.formality ?? null);
    setClimate(current.climate ?? null);
    setConfirmingLeave(false);
    setConfirmingDelete(false);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    current != null &&
    (name !== (current.name ?? "") ||
      category !== current.category ||
      active !== current.is_active ||
      formality !== (current.formality ?? null) ||
      climate !== (current.climate ?? null));

  const updateAction = useMemo(
    () => (current ? updateGarment.bind(null, current.id) : null),
    [current?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [state, formAction, pending] = useActionState<
    GarmentMutationState,
    FormData
  >(
    updateAction ?? (async () => undefined),
    undefined,
  );

  const [savedShown, setSavedShown] = useState(false);
  useEffect(() => {
    if (state?.ok) {
      setSavedShown(true);
      const t = setTimeout(() => setSavedShown(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  // Confirmación al salir con cambios
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  useEffect(() => {
    if (!confirmingLeave) return;
    const t = setTimeout(() => setConfirmingLeave(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingLeave]);

  function goBack() {
    if (onBack) onBack();
    else router.push("/closet");
  }

  function handleVolver(e: React.MouseEvent) {
    e.preventDefault();
    if (!dirty) {
      goBack();
      return;
    }
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    goBack();
  }

  function changeIdx(next: number) {
    if (dirty) {
      // Tiene cambios sin guardar — pide confirmación
      if (!confirmingLeave) {
        setConfirmingLeave(true);
        return;
      }
    }
    setIdx(next);
  }

  // Delete
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  useEffect(() => {
    if (!confirmingDelete) return;
    const t = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingDelete]);

  function handleDeleteClick() {
    if (!current) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    startDeleteTransition(async () => {
      await deleteGarment(current.id);
    });
  }

  if (!current) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center pt-6">
        <p className="text-sm text-muted-foreground">Prenda no encontrada</p>
      </section>
    );
  }

  const prevIdx = idx > 0 ? idx - 1 : null;
  const nextIdx = idx < garments.length - 1 ? idx + 1 : null;
  const photoUrl = photoUrls[current.id] ?? undefined;

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-2 lg:pt-4 animate-fade-in">
      <header className="mb-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleVolver}
          className={`h-10 inline-flex items-center rounded-full px-5 text-sm font-medium transition-colors ${
            confirmingLeave
              ? "bg-destructive text-destructive-foreground"
              : "bg-accent/8 text-foreground hover:bg-accent/15"
          }`}
        >
          {confirmingLeave ? "Salir sin guardar" : "Volver"}
        </button>
        <div className="flex items-center gap-2 text-xs">
          {state?.error && (
            <span className="text-destructive">{state.error}</span>
          )}
          {savedShown && state?.ok && (
            <span className="font-medium text-accent animate-fade-in">
              ✓ Guardado
            </span>
          )}
          {/* Nav inline tipo libro — sin URL change, solo setIdx */}
          <div className="flex items-center gap-1 rounded-full bg-accent/8 px-1 py-1">
            <button
              type="button"
              onClick={() => prevIdx != null && changeIdx(prevIdx)}
              disabled={prevIdx == null}
              aria-label="Prenda anterior"
              className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent/20 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronIcon dir="left" />
            </button>
            <span className="px-1 text-xs font-medium text-foreground">
              <span className="tabular-nums">
                {idx + 1}/{garments.length}
              </span>
              {contextLabel && (
                <span className="ml-1 text-muted-foreground">
                  · {contextLabel}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => nextIdx != null && changeIdx(nextIdx)}
              disabled={nextIdx == null}
              aria-label="Prenda siguiente"
              className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent/20 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>
          {/* Eliminar — ícono al lado del navegador de prendas. Primer toque
              pide confirmación (se pone rojo), segundo toque elimina. */}
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deletePending}
            aria-label={
              confirmingDelete ? "Confirmar eliminación" : "Eliminar prenda"
            }
            title={
              confirmingDelete ? "Confirmar eliminación" : "Eliminar prenda"
            }
            className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              confirmingDelete
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            } ${deletePending ? "opacity-50" : ""}`}
          >
            <TrashIcon />
          </button>
        </div>
      </header>
      {confirmingLeave && (
        <p className="mb-3 rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive animate-fade-in">
          Tienes cambios sin guardar. Toca de nuevo para descartarlos.
        </p>
      )}
      {confirmingDelete && !deletePending && (
        <p className="mb-3 rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive animate-fade-in">
          Toca de nuevo la papelera para eliminar esta prenda. Se cancela en 3
          segundos.
        </p>
      )}
      {(pending || deletePending) && <SaveOverlay label={deletePending ? "Eliminando…" : "Guardando…"} />}

      <form
        key={current.id}
        action={formAction}
        className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 animate-fade-in lg:grid lg:grid-cols-[1fr_1fr] lg:items-stretch lg:gap-10 lg:overflow-hidden lg:pr-0"
      >
        {/* Foto */}
        <div className="mb-5 flex min-h-0 items-stretch justify-center lg:mb-0">
          <div className="relative h-full max-h-[min(75vh,100%)] w-full max-w-[min(75vh,100%)] overflow-hidden rounded-2xl bg-accent/8 aspect-square lg:aspect-auto">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={current.name || "Prenda"}
                className="size-full object-contain"
              />
            ) : (
              <div className="grid size-full place-items-center text-sm text-muted-foreground">
                Sin foto
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-2">
          {/* Nombre */}
          <div>
            <label
              htmlFor="garment_name"
              className="mb-1.5 block text-sm font-semibold text-foreground"
            >
              Nombre
            </label>
            <input
              id="garment_name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl bg-accent/8 px-4 py-3 text-base text-foreground transition-colors focus:bg-accent/12 focus:outline-none"
            />
          </div>

          {/* Categoría */}
          <div>
            <p className="mb-2 block text-sm font-semibold text-foreground">
              Tipo de prenda
            </p>
            <div
              className="category-picker grid grid-cols-1 gap-2"
              role="radiogroup"
            >
              {CATEGORIES.map((c) => (
                <label
                  key={c.slug}
                  className="relative block h-11 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.slug}
                    checked={category === c.slug}
                    onChange={() => setCategory(c.slug)}
                    className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium gp-chip">
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Ocasión */}
          <input type="hidden" name="formality" value={formality ?? ""} />
          <div>
            <p className="mb-2 block text-sm font-semibold text-foreground">
              Ocasión
            </p>
            <div className="category-picker grid grid-cols-1 gap-2" role="radiogroup">
              {FORMALITY_OPTS.map((f) => (
                <label
                  key={f}
                  className="relative block h-11 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name={`formality-pick`}
                    checked={formality === f}
                    onChange={() => setFormality(f)}
                    className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium gp-chip">
                    {formalityLabel(f)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Clima */}
          <input type="hidden" name="climate" value={climate ?? ""} />
          <div>
            <p className="mb-2 block text-sm font-semibold text-foreground">
              Clima
            </p>
            <div className="category-picker grid grid-cols-1 gap-2" role="radiogroup">
              {CLIMATE_OPTS.map((c) => (
                <label
                  key={c}
                  className="relative block h-11 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name={`climate-pick`}
                    checked={climate === c}
                    onChange={() => setClimate(c)}
                    className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium gp-chip">
                    {climateLabel(c)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Activa — radio button real (hollow circle + inner dot que
              escala). Misma estructura que el ejemplo HTML: border lila al
              marcar + dot interior que aparece con scale 0 → 1. */}
          <input
            type="hidden"
            name="is_active"
            value={active ? "on" : "off"}
          />
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            role="switch"
            aria-checked={active}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors duration-200 ${
              active ? "bg-accent/12" : "bg-transparent hover:bg-accent/6"
            }`}
          >
            {/* Radio — centrado verticalmente con el TODO el bloque de texto */}
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                active ? "border-accent" : "border-muted-foreground/40"
              }`}
              aria-hidden
            >
              <span
                className={`size-3 rounded-full bg-accent transition-transform duration-200 ${
                  active ? "scale-100" : "scale-0"
                }`}
              />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Activa en sugerencias
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Si la apagas, la IA no te la propone al armar outfits.
              </span>
            </span>
          </button>

          {/* Guardar + Cancelar */}
          <div className="space-y-2">
            <button
              type="submit"
              disabled={pending || !dirty || !name.trim()}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!current) return;
                setName(current.name ?? "");
                setCategory(current.category);
                setActive(current.is_active);
                setFormality(current.formality ?? null);
                setClimate(current.climate ?? null);
              }}
              disabled={!dirty || pending}
              className="h-12 w-full rounded-xl bg-accent/8 text-sm font-medium text-foreground transition-colors hover:bg-accent/15 disabled:opacity-40"
            >
              Cancelar cambios
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function SaveOverlay({ label = "Guardando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md animate-fade-in"
    >
      <TshirtLoader size={100} />
      <p className="text-base font-semibold tracking-tight text-foreground">
        {label}
      </p>
    </div>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}

function TrashIcon() {
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
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
