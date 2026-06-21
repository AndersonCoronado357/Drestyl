"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import {
  justCompress,
  preloadBackgroundModel,
  quickThumbnail,
  removeBackgroundAndCompress,
} from "@/lib/image-pipeline";
import { createGarmentsBatch } from "@/app/actions/garments";
import { ClothingLoader } from "@/components/ui/clothing-loader";
import { TshirtLoader } from "@/components/ui/tshirt-loader";

type Step = "choose" | "preview" | "processing" | "review";

type Formality = "formal" | "elegante" | "casual" | "deportivo";
type Climate = "frio" | "templado" | "calor" | "mixto";

type Item = {
  id: string;
  raw: File;
  preview: string;
  compressed?: File;
  cleaned?: File;
  thumb?: File;
  aiCategory: CategorySlug | null;
  aiName: string | null;
  aiFormality: Formality | null;
  aiClimate: Climate | null;
  category: CategorySlug | null;
  name: string;
  formality: Formality | null;
  climate: Climate | null;
  bgCleaned: boolean;
  discarded: boolean;
};

const MAX_PHOTOS = 30;

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}


export function AddGarmentFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [items, setItems] = useState<Item[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [progress, setProgress] = useState({
    compress: false,
    ai: false,
    bgDone: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [saving, startSaving] = useTransition();

  // Cleanup blob URLs al desmontar.
  useEffect(() => {
    return () => {
      for (const it of items) URL.revokeObjectURL(it.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload del modelo bg removal en cuanto el usuario llega — para que
  // cuando dispare "Limpiar y analizar" el modelo ya esté en cache.
  useEffect(() => {
    preloadBackgroundModel();
  }, []);

  function handlePicked(files: FileList | File[]) {
    const arr = Array.from(files).slice(0, MAX_PHOTOS);
    if (arr.length === 0) return;
    setError(null);
    const newItems: Item[] = arr.map((raw) => ({
      id: genId(),
      raw,
      preview: URL.createObjectURL(raw),
      aiCategory: null,
      aiName: null,
      aiFormality: null,
      aiClimate: null,
      category: null,
      name: "",
      formality: null,
      climate: null,
      bgCleaned: false,
      discarded: false,
    }));
    setItems(newItems);
    setStep("preview");
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const filtered = prev.filter((it) => {
        if (it.id === id) {
          URL.revokeObjectURL(it.preview);
          return false;
        }
        return true;
      });
      if (filtered.length === 0) setStep("choose");
      return filtered;
    });
  }

  async function startProcessing() {
    setStep("processing");
    setProgress({ compress: false, ai: false, bgDone: 0 });
    setRejectedCount(0);

    // 1) Compresión + miniatura EN PARALELO (CPU corto, ~500ms × N en serie
    //    pero paralelizado por el worker pool de browser-image-compression).
    const prepared = await Promise.all(
      items.map(async (it) => {
        const [thumb, compressed] = await Promise.all([
          quickThumbnail(it.raw),
          justCompress(it.raw),
        ]);
        return { ...it, thumb, compressed };
      }),
    );
    setItems(prepared);
    setProgress((p) => ({ ...p, compress: true }));

    // 2) IA + BG removal EN PARALELO desde aquí.
    //    - La IA es una sola llamada batch a Gemini (rápida ~3-6s).
    //    - El BG corre secuencial item por item con el modelo local.
    //    En cuanto la IA termina, soltamos al usuario al review. El BG sigue
    //    corriendo en background y va marcando cada item como limpio cuando
    //    termina. Si el usuario llega a "Guardar" antes de que termine todo,
    //    los pendientes se suben sin limpiar y la cola del closet los retoma.

    const aiPromise = (async () => {
      const sugs = await callAiBatch(prepared.map((it) => it.thumb!));

      // Filtro de no-prendas: SOLO si la IA dice EXPLÍCITAMENTE
      // name="No es una prenda" (decisión positiva del modelo).
      // Si la IA falla silenciosamente (network, quota, etc.) la foto
      // pasa con campos vacíos — el usuario llena a mano.
      let rejected = 0;
      const valid: typeof prepared = [];
      prepared.forEach((it, i) => {
        const sug = sugs[i] ?? emptySuggestion;
        if (sug.name === "No es una prenda") {
          rejected++;
          URL.revokeObjectURL(it.preview);
          return;
        }
        valid.push({
          ...it,
          aiCategory: sug.category,
          aiName: sug.name,
          aiFormality: sug.formality,
          aiClimate: sug.climate,
          category: it.category ?? sug.category,
          name: it.name || sug.name || "",
          formality: it.formality ?? sug.formality,
          climate: it.climate ?? sug.climate,
        });
      });

      if (valid.length === 0) {
        setItems([]);
        setError(
          `${rejected === 1 ? "La foto no parece" : `Ninguna de las ${rejected} fotos parece`} ser una prenda. Subí fotos de ropa, calzado o accesorios.`,
        );
        setStep("choose");
        return;
      }

      setItems(valid);
      setRejectedCount(rejected);
      setProgress((p) => ({ ...p, ai: true }));
      setReviewIdx(0);
      setStep("review");
    })();

    const bgPromise = (async () => {
      for (let i = 0; i < prepared.length; i++) {
        const it = prepared[i];
        try {
          const cleaned = await removeBackgroundAndCompress(it.compressed!);
          setItems((cur) =>
            cur.map((c) =>
              c.id === it.id ? { ...c, cleaned, bgCleaned: true } : c,
            ),
          );
        } catch (err) {
          console.warn(`[bg] foto ${i} falló:`, err);
        }
        setProgress((p) => ({ ...p, bgDone: i + 1 }));
      }
    })();

    // Solo esperamos la IA para soltar al usuario. El BG sigue solo.
    await aiPromise;
    // bgPromise queda corriendo en background sin await.
    void bgPromise;
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function finalSave() {
    setError(null);
    const toSave = items.filter((it) => !it.discarded);
    if (toSave.length === 0) {
      setError("No hay prendas para guardar.");
      return;
    }
    // Si alguna no tiene categoría O nombre, saltamos al primer pendiente.
    // No auto-defaulteamos a "accesorio" ni a un nombre vacío.
    const missingIdx = items.findIndex(
      (it) => !it.discarded && (!it.category || !it.name.trim()),
    );
    if (missingIdx !== -1) {
      const missing = items[missingIdx];
      setError(
        !missing.category
          ? "Falta elegir categoría en al menos una prenda."
          : "Falta nombre en al menos una prenda.",
      );
      setReviewIdx(missingIdx);
      return;
    }

    const fd = new FormData();
    fd.append("count", String(toSave.length));
    toSave.forEach((it, i) => {
      // Si el bg ya terminó usamos la versión limpia; si no, la comprimida.
      // Las sucias quedan con bg_cleaned=false y la cola del closet las
      // limpia luego.
      const file = it.cleaned ?? it.compressed ?? it.raw;
      fd.append(`photo_${i}`, file);
      fd.append(`category_${i}`, it.category!);
      fd.append(`name_${i}`, it.name);
      fd.append(`bg_cleaned_${i}`, it.bgCleaned ? "true" : "false");
      if (it.formality) fd.append(`formality_${i}`, it.formality);
      if (it.climate) fd.append(`climate_${i}`, it.climate);
    });

    startSaving(async () => {
      const result = await createGarmentsBatch(fd);
      if (result.failed > 0) {
        setError(`${result.created} guardadas, ${result.failed} fallaron.`);
      }
      if (result.created > 0) {
        router.push("/closet");
      }
    });
  }

  if (step === "choose") {
    return <ChooseStep onPicked={handlePicked} error={error} />;
  }
  if (step === "preview") {
    return (
      <PreviewStep
        items={items}
        onRemove={removeItem}
        onAddMore={(files) => {
          const room = MAX_PHOTOS - items.length;
          if (room <= 0) return;
          const arr = Array.from(files).slice(0, room);
          const newItems: Item[] = arr.map((raw) => ({
            id: genId(),
            raw,
            preview: URL.createObjectURL(raw),
            aiCategory: null,
            aiName: null,
            aiFormality: null,
            aiClimate: null,
            category: null,
            name: "",
            formality: null,
            climate: null,
            bgCleaned: false,
            discarded: false,
          }));
          setItems((prev) => [...prev, ...newItems]);
        }}
        onBack={() => {
          for (const it of items) URL.revokeObjectURL(it.preview);
          setItems([]);
          setStep("choose");
        }}
        onProcess={startProcessing}
      />
    );
  }
  if (step === "processing") {
    return <ProcessingStep total={items.length} progress={progress} />;
  }
  if (step === "review") {
    return (
      <>
        <ReviewStep
          items={items}
          currentIdx={reviewIdx}
          onUpdate={updateItem}
          onPrev={() => setReviewIdx((i) => Math.max(0, i - 1))}
          onNext={() => setReviewIdx((i) => Math.min(items.length - 1, i + 1))}
          onSave={finalSave}
          saving={saving}
          error={error}
          rejectedCount={rejectedCount}
          onDismissRejected={() => setRejectedCount(0)}
        />
        {saving && <SaveOverlay />}
      </>
    );
  }
  return null;
}

/**
 * Overlay fullscreen mientras se hace el save batch. Bloquea interacción.
 * Usa el ClothingLoader (dot que sigue contornos de prendas).
 */
function SaveOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md animate-fade-in"
    >
      <TshirtLoader size={100} />
      <p className="text-base font-semibold tracking-tight text-foreground">
        Guardando tu clóset
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AI batch call
// ──────────────────────────────────────────────────────────────────────────

type Suggestion = {
  category: CategorySlug | null;
  name: string | null;
  formality: Formality | null;
  climate: Climate | null;
};

const emptySuggestion: Suggestion = {
  category: null,
  name: null,
  formality: null,
  climate: null,
};

async function callAiBatch(files: File[]): Promise<Suggestion[]> {
  // Timeout duro de 30s — si Gemini se cae o se cuelga, devolvemos vacío y
  // el usuario llena a mano. NUNCA dejar el loader pegado.
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 30000);
  try {
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    const res = await fetch("/api/suggest-category", {
      method: "POST",
      body: fd,
      signal: ac.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(
        "[callAiBatch] API error",
        res.status,
        data?.error,
        data?.status,
      );
      return files.map(() => emptySuggestion);
    }
    const arr = Array.isArray(data?.suggestions) ? data.suggestions : [];
    console.log(
      `[callAiBatch] ${arr.length} sugerencias recibidas`,
      arr.slice(0, 2),
    );
    return files.map((_, i) => ({
      category: (arr[i]?.category as CategorySlug) ?? null,
      name: (arr[i]?.name as string) ?? null,
      formality: (arr[i]?.formality as Formality) ?? null,
      climate: (arr[i]?.climate as Climate) ?? null,
    }));
  } catch (err) {
    console.warn("[callAiBatch] falló:", err);
    return files.map(() => emptySuggestion);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step components
// ──────────────────────────────────────────────────────────────────────────

function ChooseStep({
  onPicked,
  error,
}: {
  onPicked: (files: FileList) => void;
  error: string | null;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col pt-6 lg:pt-10">
      {/* Mobile: flex con Volver + texto a la izquierda (sin spacer porque
          el viewport es angosto y "Nueva prenda" wrap a 2 filas si no).
          PC: grid centrado con spacer invisible para mantener el balance. */}
      <header className="mb-8 grid grid-cols-[auto_1fr_auto] items-center gap-3 animate-fade-in lg:gap-6">
        <Link
          href="/closet"
          className="h-9 rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15 inline-flex items-center lg:h-10 lg:px-5"
        >
          Volver
        </Link>
        <div className="min-w-0 text-center">
          <p className="text-xs text-muted-foreground lg:text-sm">Mi clóset</p>
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-tight lg:text-2xl">
            Nueva prenda
          </h1>
        </div>
        {/* Spacer invisible MISMO ancho que Volver para mantener el texto
            centrado en mobile Y en PC. */}
        <span className="h-9 w-[4.25rem] lg:h-10 lg:w-[5rem]" aria-hidden />
      </header>

      {/* Body: stack en mobile, 2 cols en PC (instrucciones izq, acciones der) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 animate-fade-up lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-6">
        {/* Instrucciones — solo PC. Mobile las muestra debajo de los botones. */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-6 lg:rounded-2xl lg:bg-accent/5 lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Antes de empezar
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Para que se vean bien
            </h2>
          </div>
          <ul className="space-y-3">
            <BigTip n={1} title="Superficie plana">
              Extiende la prenda sobre la cama o el piso. Sin arrugas grandes.
            </BigTip>
            <BigTip n={2} title="Buena luz">
              Luz natural si puedes, sin sombras fuertes.
            </BigTip>
            <BigTip n={3} title="Encuadre completo">
              Que toda la prenda quepa en la foto, sin recortes.
            </BigTip>
            <BigTip n={4} title={`Hasta ${MAX_PHOTOS} por sesión`}>
              Sube varias de golpe y la IA categoriza todas a la vez.
            </BigTip>
          </ul>
        </aside>

        {/* Acciones — flex-1 cada card en PC para llenar alto */}
        <div className="flex flex-col gap-3 lg:gap-4 lg:[&>*]:flex-1">
          <ActionCard
            type="camera"
            title="Tomar foto"
            description="Abre la cámara del celular y captura una a una."
            icon={<CameraIcon />}
            onPicked={onPicked}
          />
          <ActionCard
            type="gallery"
            title="Subir desde galería"
            description="Selecciona hasta 30 fotos de tu galería."
            icon={<GalleryIcon />}
            onPicked={onPicked}
          />
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* Tips compactas — solo mobile. PC las tiene grandes en la izquierda. */}
          <ul className="mt-2 space-y-1.5 px-1 text-xs text-muted-foreground lg:hidden">
            <Tip>Prenda extendida sobre superficie plana</Tip>
            <Tip>Buena luz, sin sombras fuertes</Tip>
            <Tip>Hasta {MAX_PHOTOS} fotos por sesión</Tip>
          </ul>
        </div>
      </div>
    </section>
  );
}

function BigTip({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function ActionCard({
  type,
  title,
  description,
  icon,
  onPicked,
}: {
  type: "camera" | "gallery";
  title: string;
  description: string;
  icon: React.ReactNode;
  onPicked: (files: FileList) => void;
}) {
  const isCamera = type === "camera";
  return (
    <div
      className={`relative flex items-center gap-4 overflow-hidden rounded-2xl p-3 transition-colors duration-300 lg:gap-5 lg:p-4 ${
        isCamera
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-accent/8 hover:bg-accent/12"
      }`}
    >
      <input
        type="file"
        accept="image/*"
        capture={isCamera ? "environment" : undefined}
        multiple={!isCamera}
        onChange={(e) => e.target.files && onPicked(e.target.files)}
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        aria-label={title}
      />
      {/* Icono SOLO — sin container/recuadro. SVG grande, color directo. */}
      <span
        className={`flex aspect-square h-12 shrink-0 items-center justify-center lg:h-[calc(100%-1rem)] ${
          isCamera ? "text-primary-foreground" : "text-accent"
        }`}
      >
        {/* En la tarjeta de cámara (fondo morado) el PNG va en blanco. */}
        <span className={`lg:scale-[4] ${isCamera ? "[&_img]:brightness-0 [&_img]:invert" : ""}`}>
          {icon}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{title}</p>
        <p
          className={`mt-1 text-xs ${
            isCamera ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 text-accent">✦</span>
      <span>{children}</span>
    </li>
  );
}

function FileButton({
  type,
  label,
  icon,
  onPicked,
}: {
  type: "camera" | "gallery";
  label: string;
  icon: React.ReactNode;
  onPicked: (files: FileList) => void;
}) {
  const isCamera = type === "camera";
  return (
    <div className="relative h-14 w-full">
      <input
        type="file"
        accept="image/*"
        capture={isCamera ? "environment" : undefined}
        multiple={!isCamera}
        onChange={(e) => e.target.files && onPicked(e.target.files)}
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        aria-label={label}
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-xl text-base font-semibold transition-transform active:scale-[0.99] ${
          isCamera
            ? "bg-primary text-primary-foreground"
            : "bg-accent/8 text-foreground"
        }`}
      >
        {icon}
        {label}
      </div>
    </div>
  );
}

function PreviewStep({
  items,
  onRemove,
  onAddMore,
  onBack,
  onProcess,
}: {
  items: Item[];
  onRemove: (id: string) => void;
  onAddMore: (files: FileList) => void;
  onBack: () => void;
  onProcess: () => void;
}) {
  const canAddMore = items.length < MAX_PHOTOS;
  return (
    <section className="flex min-h-0 flex-1 flex-col pt-6 lg:pt-10">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-9 rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15"
        >
          Volver
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            {items.length} {items.length === 1 ? "foto" : "fotos"}
          </h1>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Quita las que no quieras o agrega más
          </p>
        </div>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
          {items.length}/{MAX_PHOTOS}
        </span>
      </header>

      <div className="custom-scroll -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 lg:gap-3 xl:grid-cols-7">
          {items.map((it) => (
            <div
              key={it.id}
              className="group relative aspect-square overflow-hidden rounded-xl bg-accent/8"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.preview}
                alt=""
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground/85 text-xs font-bold text-background shadow-md transition-transform active:scale-90"
                aria-label="Quitar foto"
              >
                ✕
              </button>
            </div>
          ))}
          {canAddMore && (
            <label className="relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-accent/5 text-muted-foreground transition-colors hover:bg-accent/15 hover:text-accent">
              <span className="text-3xl">+</span>
              <span className="text-[10px] uppercase tracking-wider">agregar</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && onAddMore(e.target.files)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2">
        <button
          type="button"
          onClick={onProcess}
          disabled={items.length === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          ✦ Limpiar y analizar {items.length}{" "}
          {items.length === 1 ? "prenda" : "prendas"}
        </button>
      </div>
    </section>
  );
}

function ProcessingStep({
  total,
  progress,
}: {
  total: number;
  progress: { compress: boolean; ai: boolean; bgDone: number };
}) {
  const bgPct = Math.round((progress.bgDone / total) * 100);
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
      <ClothingLoader size={110} />
      <p className="mt-7 text-lg font-semibold tracking-tight text-foreground">
        Procesando {total} {total === 1 ? "prenda" : "prendas"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Quédate aquí un momento
      </p>

      <div className="mt-8 w-full max-w-sm space-y-4">
        <ProgressBar
          label="Preparando fotos"
          done={progress.compress}
          pct={progress.compress ? 100 : 60}
          indeterminate={!progress.compress}
        />
        <ProgressBar
          label="IA categorizando"
          done={progress.ai}
          pct={progress.ai ? 100 : 50}
          indeterminate={!progress.ai}
        />
        <ProgressBar
          label={`Limpiando fondos · ${progress.bgDone}/${total}`}
          done={progress.bgDone === total}
          pct={bgPct}
        />
      </div>
    </section>
  );
}

function ProgressBar({
  label,
  done,
  pct,
  indeterminate,
}: {
  label: string;
  done: boolean;
  pct: number;
  indeterminate?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span
          className={`font-medium ${done ? "text-accent" : "text-muted-foreground"}`}
        >
          {label}
        </span>
        <span
          className={`tabular-nums ${done ? "text-accent" : "text-muted-foreground/70"}`}
        >
          {done ? "✓" : `${pct}%`}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-accent/10">
        <div
          className={`h-full rounded-full bg-accent transition-all duration-500 ${indeterminate ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReviewStep({
  items,
  currentIdx,
  onUpdate,
  onPrev,
  onNext,
  onSave,
  saving,
  error,
  rejectedCount,
  onDismissRejected,
}: {
  items: Item[];
  currentIdx: number;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  rejectedCount: number;
  onDismissRejected: () => void;
}) {
  const item = items[currentIdx];

  // useMemo + useEffect deben llamarse SIEMPRE (regla de hooks), antes de
  // cualquier early return. Si la foto ya pasó por bg removal, mostramos
  // esa; si no, el preview original (mientras el bg sigue corriendo).
  const previewSrc = useMemo(() => {
    if (!item) return "";
    return item.cleaned ? URL.createObjectURL(item.cleaned) : item.preview;
  }, [item]);

  useEffect(() => {
    const wasCreated = !!item?.cleaned;
    return () => {
      if (wasCreated && previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc, item?.cleaned]);

  if (!item) return null;
  const isLast = currentIdx === items.length - 1;
  const approvedCount = items.filter((it) => !it.discarded).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6 lg:overflow-hidden lg:pt-10">
      {/* Header con navegación entre prendas + indicador de progreso visual */}
      <header className="mb-5 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIdx === 0}
            className="h-9 rounded-full bg-accent/8 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent/15 disabled:opacity-30 disabled:hover:bg-accent/8"
          >
            Anterior
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              Prenda {currentIdx + 1} de {items.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {approvedCount} para guardar
            </p>
          </div>
          <button
            type="button"
            onClick={isLast ? onSave : onNext}
            disabled={isLast ? saving || approvedCount === 0 : false}
            className={`h-9 rounded-full px-4 text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 ${
              isLast
                ? "bg-primary text-primary-foreground"
                : "bg-accent/8 text-foreground hover:bg-accent/15"
            }`}
          >
            {isLast
              ? saving
                ? "Guardando…"
                : "Guardar"
              : "Siguiente"}
          </button>
        </div>
        {/* Barra de pasos */}
        <div className="flex gap-1">
          {items.map((it, i) => (
            <div
              key={it.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === currentIdx
                  ? "bg-accent"
                  : it.discarded
                    ? "bg-destructive/40"
                    : i < currentIdx
                      ? "bg-accent/40"
                      : "bg-muted"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Body — en MOBILE: flujo natural (foto arriba, form abajo) y la
          SECCIÓN entera scrollea como una sola pieza. En PC: grid 2 columnas
          y solo el form scrollea internamente. */}
      <div
        key={item.id}
        className="flex flex-col gap-5 animate-fade-in lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:items-stretch lg:gap-10"
      >
        {/* Foto — natural en mobile, full-height en PC */}
        <div className="flex flex-col items-center justify-center lg:h-full">
          <div
            className={`relative aspect-square w-full max-w-[min(70vh,100%)] overflow-hidden rounded-2xl bg-accent/8 transition-opacity duration-200 lg:aspect-auto lg:h-full ${
              item.discarded ? "opacity-40" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt=""
              className="size-full object-contain"
            />
            {/* "Fondo limpio" en lila (no negro) */}
            {item.bgCleaned && !item.discarded && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent/90 px-2.5 py-0.5 text-[10px] font-medium text-accent-foreground backdrop-blur-sm">
                ✓ fondo limpio
              </span>
            )}
            {/* Si descartada: overlay con badge lila */}
            {item.discarded && (
              <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
                  Descartada
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Form — en mobile fluye con la página (la sección padre scrollea);
            en PC scrollea internamente para mantener el split a la izquierda. */}
        <div className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
          {/* Categoría — opciones stacked, 1 por fila */}
          <PickerRow
            label="¿Qué tipo de prenda es?"
            value={item.category}
            aiValue={item.aiCategory}
            options={CATEGORIES.map((c) => c.slug)}
            labelOf={(s) => CATEGORIES.find((c) => c.slug === s)?.label ?? s}
            onChange={(v) => onUpdate(item.id, { category: v })}
            name={`category-${item.id}`}
          />

          {/* Nombre — obligatorio */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label
                htmlFor={`name-${item.id}`}
                className="block text-sm font-semibold text-foreground"
              >
                Nombre
              </label>
              {item.aiName && item.name === item.aiName && (
                <span className="text-xs font-medium text-accent">
                  ✦ por IA
                </span>
              )}
            </div>
            <input
              id={`name-${item.id}`}
              type="text"
              required
              value={item.name}
              onChange={(e) => onUpdate(item.id, { name: e.target.value })}
              maxLength={80}
              className="w-full rounded-xl bg-accent/8 px-4 py-3 text-base text-foreground focus:outline-none focus:bg-accent/12"
            />
          </div>

          {/* Formality + Climate — chips con ancho natural que se wrappean
              automáticamente según el espacio. Sin scroll, sin huecos. */}
          <PickerRow
            label="Ocasión"
            value={item.formality}
            aiValue={item.aiFormality}
            options={["formal", "elegante", "casual", "deportivo"] as Formality[]}
            labelOf={formalityLabel}
            onChange={(v) => onUpdate(item.id, { formality: v as Formality })}
            name={`formality-${item.id}`}
          />
          <PickerRow
            label="Clima"
            value={item.climate}
            aiValue={item.aiClimate}
            options={["frio", "templado", "calor", "mixto"] as Climate[]}
            labelOf={climateLabel}
            onChange={(v) => onUpdate(item.id, { climate: v as Climate })}
            name={`climate-${item.id}`}
          />

          {/* Descartar/Recuperar ahora es icono flotante en la foto — no
              ocupa fila adicional acá. */}
          {/* Descartar / Recuperar — fila propia, grande, abajo del form */}
          <button
            type="button"
            onClick={() => onUpdate(item.id, { discarded: !item.discarded })}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${
              item.discarded
                ? "bg-accent/15 text-accent hover:bg-accent/25"
                : "bg-destructive/15 text-destructive hover:bg-destructive/25"
            }`}
          >
            {item.discarded ? <RecoverIcon /> : <TrashIcon />}
            <span>
              {item.discarded ? "Recuperar prenda" : "Descartar prenda"}
            </span>
          </button>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Iconos
// ──────────────────────────────────────────────────────────────────────────

function PickerRow<T extends string>({
  label,
  value,
  aiValue,
  options,
  labelOf,
  onChange,
  name,
}: {
  label: string;
  value: T | null;
  aiValue: T | null;
  options: T[];
  labelOf: (v: T) => string;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {aiValue && value === aiValue && (
          <span className="text-xs font-medium text-accent">✦ por IA</span>
        )}
      </div>
      {/* Cada opción en su propia fila — stacked grid-cols-1. */}
      <div className="category-picker grid grid-cols-1 gap-2" role="radiogroup">
        {options.map((opt) => (
          <label
            key={opt}
            className="relative block h-11 cursor-pointer select-none"
          >
            <input
              type="radio"
              name={name}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl px-2 text-sm font-medium gp-chip">
              {labelOf(opt)}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function formalityLabel(f: Formality): string {
  switch (f) {
    case "formal":
      return "Formal";
    case "elegante":
      return "Elegante";
    case "casual":
      return "Casual";
    case "deportivo":
      return "Deportivo";
  }
}

function climateLabel(c: Climate): string {
  switch (c) {
    case "frio":
      return "Clima frío";
    case "templado":
      return "Templado";
    case "calor":
      return "Calor";
    case "mixto":
      return "Cualquier clima";
  }
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
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

function RecoverIcon() {
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
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/camera.png"
      alt=""
      width={28}
      height={28}
      style={{ width: 28, height: 28, objectFit: "contain" }}
      aria-hidden="true"
    />
  );
}

function GalleryIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/upload.png"
      alt=""
      width={28}
      height={28}
      style={{ width: 28, height: 28, objectFit: "contain" }}
      aria-hidden="true"
    />
  );
}
