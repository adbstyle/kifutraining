-- ============================================================================
-- Team-Trainingsplan Story 13: Verlassen, Entfernen, Auflösen
-- ============================================================================
-- Verlassen und Entfernen sind derselbe Vorgang — im Team sind alle
-- gleichberechtigt, es gibt keine Rolle, die das eine dürfte und das andere
-- nicht. Der einzige Unterschied ist die Tragweite: entfernt der Vorgang das
-- LETZTE Mitglied, löst er das Team samt seinen Trainings und Terminen auf.
--
-- Darum eine RPC statt der blossen DELETE-Policy: Zählung und Löschung müssen
-- in derselben Transaktion liegen. Sonst könnte zwischen „bist nicht die
-- Letzte" und dem Löschen jemand anders austreten — und das Team verschwände
-- ohne Bestätigung.
create function entferne_team_mitglied(
  p_team uuid,
  p_user uuid,
  p_bestaetigt boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_verbleibend int;
  v_bilder jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = p_user) then
    -- Schon weg: kein Fehler, der Zielzustand ist erreicht.
    return jsonb_build_object('status', 'entfernt');
  end if;

  -- Sperren, damit ein gleichzeitiger Austritt die Zählung nicht überholt.
  perform 1 from teams where id = p_team for update;

  select count(*) - 1 into v_verbleibend
    from team_members where team_id = p_team;

  if v_verbleibend = 0 and not p_bestaetigt then
    return jsonb_build_object('status', 'aufloesung_noetig');
  end if;

  -- Löst der Vorgang das Team auf, verschwinden mit ihm die Bildkopien seiner
  -- Trainings. Ihre Pfade werden hier eingesammelt — INNERHALB der Transaktion,
  -- die auch entscheidet, ob wirklich aufgelöst wird. Vorher aufzuräumen hiesse,
  -- den Bestand eines Teams zu vernichten, das die Zählung anschliessend am
  -- Leben lässt (gleichzeitiger Beitritt). Die Dateien selbst entfernt der
  -- Aufrufer danach; die Kaskade nimmt nur die Zeilen mit.
  if v_verbleibend = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('id', te.id, 'bild_url', te.bild_url)), '[]'::jsonb)
      into v_bilder
      from training_exercises te
      join trainings t on t.id = te.training_id
     where t.team_id = p_team and te.bild_url is not null;
  end if;

  delete from team_members where team_id = p_team and user_id = p_user;

  -- Ein Team ohne Mitglieder besteht nicht fort: der Trigger
  -- team_aufloesen_wenn_leer hat es samt Trainings und Terminen entfernt.
  if v_verbleibend = 0 then
    return jsonb_build_object('status', 'aufgeloest', 'bilder', v_bilder);
  end if;
  return jsonb_build_object('status', 'entfernt');
end;
$$;
revoke all on function entferne_team_mitglied(uuid, uuid, boolean) from public, anon;
grant execute on function entferne_team_mitglied(uuid, uuid, boolean) to authenticated;
