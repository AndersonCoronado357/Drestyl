-- Drestyl — migración 005: bucket privado por usuario.
--
-- Cada usuario tiene su propio bucket "user-{user_id}". Se crea automáticamente
-- al hacer signup. Path interno: "{garment_id}/photo.{ext}".
--
-- NOTA: Supabase no permite `delete from storage.objects` ni
-- `delete from storage.buckets` desde SQL — esas operaciones solo se hacen
-- desde la Storage API. El bucket viejo 'garments' se queda huérfano pero
-- sin policies (inaccesible). Bórralo manualmente desde Supabase Dashboard
-- → Storage → garments → "..." → Delete bucket.

-- 1) Borrar prendas existentes (data de desarrollo). public.garments sí
-- permite delete normal.
delete from public.garments;

-- 2) Drop policies viejas del bucket compartido (lo deja inaccesible).
drop policy if exists "garments_storage_select_own" on storage.objects;
drop policy if exists "garments_storage_insert_own" on storage.objects;
drop policy if exists "garments_storage_update_own" on storage.objects;
drop policy if exists "garments_storage_delete_own" on storage.objects;

-- 3) Crear bucket personal para users existentes.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    insert into storage.buckets (id, name, public)
    values ('user-' || u.id, 'user-' || u.id, false)
    on conflict (id) do nothing;
  end loop;
end $$;

-- 4) UNA policy genérica por operación: usuario solo opera en su bucket
-- 'user-{auth.uid()}'.
drop policy if exists "user_bucket_select" on storage.objects;
create policy "user_bucket_select"
  on storage.objects for select
  using (bucket_id = 'user-' || auth.uid()::text);

drop policy if exists "user_bucket_insert" on storage.objects;
create policy "user_bucket_insert"
  on storage.objects for insert
  with check (bucket_id = 'user-' || auth.uid()::text);

drop policy if exists "user_bucket_update" on storage.objects;
create policy "user_bucket_update"
  on storage.objects for update
  using (bucket_id = 'user-' || auth.uid()::text);

drop policy if exists "user_bucket_delete" on storage.objects;
create policy "user_bucket_delete"
  on storage.objects for delete
  using (bucket_id = 'user-' || auth.uid()::text);

-- 5) Trigger handle_new_user actualizado: crea el bucket del usuario al
-- registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_bucket text;
begin
  v_gender := nullif(trim(new.raw_user_meta_data->>'gender'), '');
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

  v_bucket := 'user-' || new.id;
  insert into storage.buckets (id, name, public)
  values (v_bucket, v_bucket, false)
  on conflict (id) do nothing;

  return new;
end;
$$;
