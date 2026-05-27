-- Drestyl — migración 011: tabla outfits.
-- Guarda los outfits que el usuario ACEPTA (toca "Usar"). Las sugerencias
-- generadas pero no aceptadas no se persisten — solo viven en memoria del
-- cliente hasta que el usuario decide.
--
-- `garment_ids` es un array de uuid (mismo orden visual del outfit).
-- `weather_snapshot` queda jsonb por flexibilidad: temp, condición, hi/lo,
-- humedad, sensación, etc. — el formato exacto puede evolucionar.
-- `source` distingue cómo se armó: la IA pura, una edición del usuario
-- (cambió alguna pieza con el picker) o un fallback no-IA cuando la cuota
-- de Gemini se agotó.

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  worn_date date not null,
  garment_ids uuid[] not null,
  occasion text,
  weather_snapshot jsonb,
  reasoning text,
  source text not null default 'ai_suggested'
    check (source in ('ai_suggested', 'user_edited', 'fallback')),
  created_at timestamptz not null default now(),
  constraint outfits_garment_ids_not_empty
    check (array_length(garment_ids, 1) > 0)
);

-- Índice para queries del tipo "outfits del usuario en los últimos N días"
-- (lo usa la IA para no repetir prendas recientes).
create index if not exists outfits_user_date_idx
  on public.outfits (user_id, worn_date desc);

-- RLS — solo el dueño puede ver/escribir sus outfits.
alter table public.outfits enable row level security;

drop policy if exists "outfits_select_own" on public.outfits;
create policy "outfits_select_own"
  on public.outfits
  for select
  using (auth.uid() = user_id);

drop policy if exists "outfits_insert_own" on public.outfits;
create policy "outfits_insert_own"
  on public.outfits
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "outfits_update_own" on public.outfits;
create policy "outfits_update_own"
  on public.outfits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "outfits_delete_own" on public.outfits;
create policy "outfits_delete_own"
  on public.outfits
  for delete
  using (auth.uid() = user_id);
