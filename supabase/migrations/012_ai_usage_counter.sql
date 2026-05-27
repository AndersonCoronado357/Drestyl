-- Drestyl — migración 012: contador de llamadas a la IA por día.
-- Reemplaza el localStorage del cliente (que se puede manipular) por un
-- contador autoritativo en la DB protegido por RLS.
--
-- `ai_calls_date` = la fecha (local del servidor) de la última llamada.
-- `ai_calls_count` = cuántas llamadas se hicieron ese día. Al pasar de
-- día se resetea a 0 en la lectura del endpoint.
--
-- Por qué en profiles (y no en una tabla aparte):
--  - 1 fila por usuario, no crece con el tiempo
--  - Una sola lectura en el endpoint (ya leíamos profile)
--  - Update simple, sin INSERT
-- Si más adelante queremos analytics finas (qué horas usa, etc),
-- migramos a una tabla append-only.

alter table public.profiles
  add column if not exists ai_calls_date date,
  add column if not exists ai_calls_count integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_ai_calls_count_check;
alter table public.profiles
  add constraint profiles_ai_calls_count_check
    check (ai_calls_count >= 0);
