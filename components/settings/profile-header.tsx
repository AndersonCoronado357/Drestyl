"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName, uploadAvatar } from "@/app/actions/profile";
import { AvatarCropper } from "./avatar-cropper";

/**
 * Header de Ajustes: foto + nombre editables in situ (donde ya estaban).
 * - Foto: hover sobre el avatar muestra "Cambiar foto"; al hacer clic se elige
 *   un archivo y aparece el recortador (AvatarCropper) para ajustarla.
 * - Nombre: doble clic activa la edición inline; guarda al salir (blur o Enter).
 */
export function ProfileHeader({
  initialName,
  avatarUrl,
  email,
  initial,
}: {
  initialName: string;
  avatarUrl: string | null;
  email: string;
  initial: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Avatar ---
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- Nombre ---
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // "Guardado" (morado) a la derecha del header al terminar; se va solo a los 2s.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const shownAvatar = localAvatar ?? avatarUrl;

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite reelegir el mismo archivo
    if (f) setCropFile(f);
  }

  async function handleCropped(cropped: File) {
    setCropFile(null);
    setError(null);
    setUploading(true);
    setLocalAvatar(URL.createObjectURL(cropped)); // preview instantáneo
    const fd = new FormData();
    fd.append("photo", cropped);
    const res = await uploadAvatar(undefined, fd);
    setUploading(false);
    if (res?.error) {
      setError(res.error);
      setLocalAvatar(null);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  function startEdit() {
    setEditing(true);
    setError(null);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitName() {
    setEditing(false);
    const v = name.trim();
    if (!v || v === initialName) {
      setName(initialName);
      return;
    }
    const fd = new FormData();
    fd.append("display_name", v);
    const res = await updateDisplayName(undefined, fd);
    if (res?.error) {
      setError(res.error);
      setName(initialName);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <>
      <header className="mb-8 flex shrink-0 items-center gap-4">
        {/* Avatar con hover "Cambiar foto" */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Cambiar foto"
          className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-2xl font-semibold text-accent-foreground"
        >
          {shownAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownAvatar}
              alt="Foto de perfil"
              className="size-full object-cover"
            />
          ) : (
            initial
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/55 px-1 text-center text-[10px] font-medium leading-tight text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Cambiar foto
          </span>
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-black/55">
              <span className="block size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickFile}
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Tu cuenta
          </p>
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.blur();
                } else if (e.key === "Escape") {
                  setName(initialName);
                  setEditing(false);
                }
              }}
              className="mt-0.5 w-full rounded-lg bg-accent/8 px-2 py-0.5 text-2xl font-semibold tracking-tight text-foreground transition-colors focus:bg-accent/12 focus:outline-none"
            />
          ) : (
            <h1
              onDoubleClick={startEdit}
              title="Doble clic para editar"
              className="mt-0.5 cursor-text truncate rounded-lg px-2 py-0.5 text-2xl font-semibold tracking-tight transition-colors hover:bg-accent/8"
            >
              {name}
            </h1>
          )}
          <p className="truncate px-1.5 text-sm text-muted-foreground">{email}</p>
          {error && (
            <p className="px-1.5 text-xs text-destructive">{error}</p>
          )}
        </div>

        {saved && (
          <span className="shrink-0 self-center text-sm font-medium text-accent animate-fade-in">
            Guardado
          </span>
        )}
      </header>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onReady={handleCropped}
        />
      )}
    </>
  );
}
