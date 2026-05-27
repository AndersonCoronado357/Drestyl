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

// Toggle con useState alternando el `type` del input. Más confiable en mobile
// que el truco CSS con `:has()` + `-webkit-text-security` (que falla en
// Firefox Android y browsers viejos). Como bonus, type="password" deja que el
// navegador ofrezca guardar la contraseña.
export function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  minLength,
  placeholder,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center rounded-xl bg-accent/8 pr-1">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 pl-4 pr-2 text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        onTouchEnd={(e) => {
          // Algunos browsers móviles tragan el `click` cuando hay scroll/zoom
          // en curso. `touchend` garantiza que el toggle reacciona al tap.
          e.preventDefault();
          setVisible((v) => !v);
        }}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
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
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
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
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}
