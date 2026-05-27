-- Drestyl — migración 006: columna `bg_cleaned` en garments.
--
-- La subida de prendas ya no espera al bg removal (era lentísimo en mobile).
-- La foto se sube con su fondo original, `bg_cleaned=false`. Después, en
-- background, el closet procesa las prendas con bg_cleaned=false una por una
-- corriendo el modelo en el browser y reemplaza la foto en storage.

alter table public.garments
  add column if not exists bg_cleaned boolean not null default false;

-- Índice para que la query "garments del user con bg_cleaned=false" sea rápida.
create index if not exists garments_pending_bg_idx
  on public.garments (user_id, bg_cleaned)
  where bg_cleaned = false;
