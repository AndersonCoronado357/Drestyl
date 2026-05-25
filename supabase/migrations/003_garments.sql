-- Drestyl — migración 003: tabla garments + RLS + bucket 'garments' + policies.
-- También agrega columna `gender` a profiles para que la IA arme outfits
-- acorde al tipo de ropa del usuario.

-- 1) Columna gender en profiles.
alter table public.profiles
  add column if not exists gender text not null default 'mixto'
    check (gender in ('masculino', 'femenino', 'mixto'));

-- Actualizamos el trigger handle_new_user para que también lea gender del
-- raw_user_meta_data cuando el usuario se registra eligiendo género.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
begin
  v_gender := nullif(trim(new.raw_user_meta_data->>'gender'), '');
  -- Solo aceptamos valores válidos; cualquier otra cosa cae al default 'mixto'.
  if v_gender is null or v_gender not in ('masculino', 'femenino', 'mixto') then
    v_gender := 'mixto';
  end if;

  insert into public.profiles (id, display_name, gender)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    v_gender
  );
  return new;
end;
$$;

-- 2) Tabla garments.
create table if not exists public.garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text,
  category text not null,
  photo_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lista cerrada de categorías. 6 grupos amplios — la IA es multimodal,
  -- ve la foto y deduce los detalles. Si se necesita ajustar, otra migration.
  constraint garments_category_check check (
    category in (
      'superior',     -- camisetas, camisas, polos, blusas
      'sobreprenda',  -- chaquetas, blazers, abrigos, sudaderas con cierre
      'inferior',     -- pantalones, jeans, shorts, faldas
      'calzado',      -- tenis, zapatos, sandalias, botas
      'accesorio',    -- gorras, sombreros, bufandas, cinturones, gafas
      'joyeria'       -- anillos, cadenas, aretes, relojes
    )
  )
);

-- Índices para queries comunes.
create index if not exists garments_user_id_idx on public.garments (user_id);
create index if not exists garments_user_active_idx
  on public.garments (user_id, is_active);

-- 3) RLS — cada usuario solo ve/edita sus propias prendas.
alter table public.garments enable row level security;

drop policy if exists "garments_select_own" on public.garments;
create policy "garments_select_own"
  on public.garments
  for select
  using (auth.uid() = user_id);

drop policy if exists "garments_insert_own" on public.garments;
create policy "garments_insert_own"
  on public.garments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "garments_update_own" on public.garments;
create policy "garments_update_own"
  on public.garments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "garments_delete_own" on public.garments;
create policy "garments_delete_own"
  on public.garments
  for delete
  using (auth.uid() = user_id);

-- 4) Trigger updated_at (reutiliza touch_updated_at de la migración 001).
drop trigger if exists garments_touch_updated_at on public.garments;
create trigger garments_touch_updated_at
  before update on public.garments
  for each row execute function public.touch_updated_at();

-- 5) Storage bucket privado 'garments'.
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

-- 6) Storage policies — el dueño puede leer/escribir solo objetos cuyo path
-- empieza con su user_id: '{user_id}/{garment_id}.webp'.
drop policy if exists "garments_storage_select_own" on storage.objects;
create policy "garments_storage_select_own"
  on storage.objects
  for select
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "garments_storage_insert_own" on storage.objects;
create policy "garments_storage_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "garments_storage_update_own" on storage.objects;
create policy "garments_storage_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "garments_storage_delete_own" on storage.objects;
create policy "garments_storage_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'garments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
