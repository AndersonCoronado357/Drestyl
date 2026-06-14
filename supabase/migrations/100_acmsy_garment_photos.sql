-- acmsy: las fotos de prendas se guardan en la BD de acmsy (no en Supabase).
-- Acceso solo server-side (pool superusuario); la URL pública va firmada (HMAC),
-- así que no hace falta RLS en esta tabla.
create table if not exists public.garment_photos (
  path text primary key,                 -- "user-<uid>/<garmentId>/photo.<ext>"
  user_id uuid not null,
  data bytea not null,
  content_type text not null default 'image/webp',
  updated_at timestamptz not null default now()
);
create index if not exists garment_photos_user_idx on public.garment_photos (user_id);
