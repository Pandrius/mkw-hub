-- ============================================================
-- Penalties de una war
-- ============================================================
-- Penalizaciones por incumplir normas: aparecen en la tabla como una línea con un nombre libre
-- ("Penalty", "Late", …) y una puntuación negativa que se resta al total del equipo.
--   [{ "side": "home" | "away", "label": "Penalty", "points": -5 }, …]

alter table public.events add column if not exists penalties jsonb not null default '[]'::jsonb;

-- Sustituye la lista completa de penalties. Mismas reglas que el resto de escrituras:
-- solo wars con el evento abierto y por quien puede editarlo.
create function public.set_event_penalties(target uuid, penalties jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  item jsonb;
  clean jsonb := '[]'::jsonb;
  pts numeric;
  lbl text;
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  if (select kind from public.events where id = target) <> 'war' then
    raise exception 'invalid: only wars have penalties';
  end if;
  if penalties is null or jsonb_typeof(penalties) <> 'array' or jsonb_array_length(penalties) > 20 then
    raise exception 'invalid: penalties must be a list of at most 20 items';
  end if;

  for item in select * from jsonb_array_elements(penalties) loop
    if jsonb_typeof(item) <> 'object' or (item ->> 'side') not in ('home', 'away') then
      raise exception 'invalid: each penalty needs a side (home or away)';
    end if;
    lbl := btrim(coalesce(item ->> 'label', ''));
    if char_length(lbl) not between 1 and 40 then
      raise exception 'invalid: the penalty name must have 1-40 characters';
    end if;
    if jsonb_typeof(item -> 'points') <> 'number' then
      raise exception 'invalid: penalty points must be a number';
    end if;
    pts := (item ->> 'points')::numeric;
    if pts <> trunc(pts) or pts not between -500 and -1 then
      raise exception 'invalid: penalty points must be a whole negative number (-1 to -500)';
    end if;
    clean := clean || jsonb_build_array(
      jsonb_build_object('side', item ->> 'side', 'label', lbl, 'points', pts::int)
    );
  end loop;

  update public.events set penalties = clean where id = target;
end;
$$;

revoke execute on function public.set_event_penalties(uuid, jsonb) from public, anon;
grant execute on function public.set_event_penalties(uuid, jsonb) to authenticated;
