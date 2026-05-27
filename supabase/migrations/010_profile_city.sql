-- Drestyl — migración 010: nombre de ciudad en profiles.
-- `default_lat` y `default_lng` ya existen desde la migración 001. Falta
-- guardar el nombre legible (resuelto vía Open-Meteo Geocoding API en el
-- onboarding) para mostrarlo en la pantalla Hoy junto al clima.

alter table public.profiles
  add column if not exists default_city text;

-- Sanity check: largo razonable de nombre de ciudad.
alter table public.profiles
  drop constraint if exists profiles_default_city_check;
alter table public.profiles
  add constraint profiles_default_city_check
    check (default_city is null or char_length(default_city) <= 120);
