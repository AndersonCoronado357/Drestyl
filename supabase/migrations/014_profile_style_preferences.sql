-- Drestyl — migración 014: preferencias de estilo en profiles.
-- Texto libre que el usuario escribe en Ajustes describiendo cómo le
-- gusta vestirse. La IA lo recibe en el prompt al armar outfits para
-- respetar gustos personales que no se infieren de las fotos (ej.
-- "prefiero colores neutros", "no me gusta usar shorts").
--
-- Cap 500 chars: suficiente para 3-5 frases descriptivas, no tan largo
-- que infle el prompt de Gemini.

alter table public.profiles
  add column if not exists style_preferences text;

alter table public.profiles
  drop constraint if exists profiles_style_preferences_check;
alter table public.profiles
  add constraint profiles_style_preferences_check
    check (style_preferences is null or char_length(style_preferences) <= 500);
