-- Drestyl — migración 008: fusiona "joyeria" dentro de "accesorio".
-- Joyería es esencialmente una sub-categoría de accesorios y la separación
-- creaba ruido en el closet sin valor real.

-- 1) Mover prendas existentes
update public.garments set category = 'accesorio' where category = 'joyeria';

-- 2) Actualizar el check constraint para quitar 'joyeria' de los slugs válidos
alter table public.garments drop constraint if exists garments_category_check;
alter table public.garments add constraint garments_category_check check (
  category in (
    'superior',
    'sobreprenda',
    'inferior',
    'calzado',
    'accesorio'
  )
);
