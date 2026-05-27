-- Drestyl — migración 007: recrea buckets de usuario que se hayan borrado
-- manualmente. Esto es defensivo: si alguien borra su bucket desde el
-- dashboard de Supabase, la próxima vez que entre a la app debe poder
-- subir prendas sin trabarse.
--
-- Idempotente: el `on conflict do nothing` hace que correrlo de nuevo no
-- duplique ni rompa nada.

do $$
declare
  u record;
  v_bucket text;
begin
  for u in select id from auth.users loop
    v_bucket := 'user-' || u.id;
    insert into storage.buckets (id, name, public)
    values (v_bucket, v_bucket, false)
    on conflict (id) do nothing;
  end loop;
end $$;

-- También vamos a marcar todas las prendas existentes como bg_cleaned=false
-- (por si alguna quedó con true por errores anteriores), para que el queue
-- las re-procese y todas tengan fondo limpio.
-- Comentado por default: si querés re-limpiar TODAS las prendas, descomenta.
-- update public.garments set bg_cleaned = false;
