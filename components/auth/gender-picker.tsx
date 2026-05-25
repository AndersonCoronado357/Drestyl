import { GENDERS, type GenderSlug } from "@/lib/gender";

const SHORT_LABEL: Record<GenderSlug, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  mixto: "Mixto",
};

type Props = {
  name: string;
  defaultValue?: GenderSlug;
};

/**
 * Selector de género con radios HTML nativos. El browser maneja el toggle
 * (sin React state, sin onClick) y un pill lila se desliza al chip activo
 * vía CSS `:has(input[value="..."]:checked)`. El pill está FUERA del grid
 * (hermano del row) para que no consuma un slot y no empuje Mixto abajo.
 */
export function GenderPicker({ name, defaultValue = "mixto" }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="block text-sm font-medium text-foreground">
        ¿Cómo te vistes?
      </p>
      <div className="gender-picker relative">
        <div className="gp-pill" aria-hidden="true" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {GENDERS.map((g) => (
            <label
              key={g.slug}
              className="relative z-10 block h-11 cursor-pointer select-none"
            >
              <input
                type="radio"
                name={name}
                value={g.slug}
                defaultChecked={g.slug === defaultValue}
                className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl opacity-0"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium gp-chip">
                {SHORT_LABEL[g.slug]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
