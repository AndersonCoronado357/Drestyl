-- Drestyl — migración 009: columnas `formality` y `climate` en garments.
-- La IA ya detecta estos atributos al categorizar; los persistimos para
-- que la sugerencia de outfits del día pueda filtrar por ocasión y clima
-- real reportado por Open-Meteo.

alter table public.garments
  add column if not exists formality text
    check (formality is null or formality in ('formal', 'elegante', 'casual', 'deportivo')),
  add column if not exists climate text
    check (climate is null or climate in ('frio', 'templado', 'calor', 'mixto'));

-- Índice ligero para queries del tipo "outfit casual para clima templado".
create index if not exists garments_formality_idx
  on public.garments (user_id, formality)
  where formality is not null;
create index if not exists garments_climate_idx
  on public.garments (user_id, climate)
  where climate is not null;
