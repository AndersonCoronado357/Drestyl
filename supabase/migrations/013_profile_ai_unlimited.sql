-- Drestyl — migración 013: flag de "cupo ilimitado" en profiles.
-- Para el usuario de testing (Ander) que necesita regenerar outfits sin
-- límite mientras se construye/depura la app. El resto sigue con el
-- límite normal de 4 outfits/día.
--
-- Es un flag, no un override numérico: si está true, el endpoint se
-- saltea el chequeo del contador y NO incrementa nada. Si más adelante
-- querés "premiar" otros usuarios o hacer pruebas, basta con un
-- UPDATE manual.

alter table public.profiles
  add column if not exists ai_calls_unlimited boolean not null default false;

-- Habilita cupo ilimitado para el dueño del proyecto.
update public.profiles
  set ai_calls_unlimited = true
  where id = (
    select id from auth.users
    where email = 'andersoncoronado157@gmail.com'
    limit 1
  );
