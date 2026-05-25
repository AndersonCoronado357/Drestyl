"use client";

import { useState } from "react";

type Props = {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
};

const fieldClass =
  "w-full rounded-xl border border-transparent bg-accent/8 py-3 pl-4 pr-12 text-base text-foreground placeholder:text-muted-foreground/60";

export function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-transform active:scale-90"
      >
        {/* Dos íconos superpuestos con crossfade + escala + rotación */}
        <span className="relative grid size-5 place-items-center">
          <EyeIcon
            className={[
              "absolute inset-0 transition-all duration-200 ease-out",
              show
                ? "scale-50 rotate-12 opacity-0"
                : "scale-100 rotate-0 opacity-100",
            ].join(" ")}
          />
          <EyeOffIcon
            className={[
              "absolute inset-0 transition-all duration-200 ease-out",
              show
                ? "scale-100 rotate-0 opacity-100"
                : "scale-50 -rotate-12 opacity-0",
            ].join(" ")}
          />
        </span>
      </button>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Mismo ojo completo + línea diagonal encima */}
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
