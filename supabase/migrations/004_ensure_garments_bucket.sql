-- Drestyl — migración 004: garantiza que el bucket 'garments' y sus policies
-- existen. Si la migración 003 fue parcial o el bucket se eliminó, esto
-- reconstruye lo necesario.

-- Bucket privado.
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do update set public = excluded.public;

-- Policies (drop + create para idempotencia).
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
