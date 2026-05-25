-- Drestyl — migración 001: tabla profiles + trigger + RLS.
-- Correr esta migración en Supabase: SQL Editor → New query → pegar todo → Run.

-- 1) Tabla profiles. Una fila por usuario, ligada por FK a auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  default_lat double precision,
  default_lng double precision,
  repeat_window_days integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sanity checks.
  constraint profiles_repeat_window_days_check
    check (repeat_window_days between 1 and 60),
  constraint profiles_lat_check
    check (default_lat is null or (default_lat between -90 and 90)),
  constraint profiles_lng_check
    check (default_lng is null or (default_lng between -180 and 180))
);

-- 2) Row Level Security: cada usuario solo ve / edita su propia fila.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) Trigger que crea la fila de profiles automáticamente al registrar un user.
-- security definer => corre con los permisos del owner de la función, no del
-- usuario invocante, para poder escribir en profiles sin que las policies
-- bloqueen (el trigger lo dispara el sistema al hacer signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Trigger para mantener updated_at al día.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
