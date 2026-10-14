-- ============================================================================
-- Mitgliederliste mit E-Mail-Adresse (#425)
--
-- Die Mitglieder eines Teams sehen einander künftig auch mit E-Mail-Adresse —
-- damit erkennbar ist, wer hinter «Trainer:in a1b2» oder einem Kürzel steckt.
-- Das hebt die bisherige Zusage aus dem Team-Epic auf (Story 4 AK 7 / NFR 1:
-- «nie die E-Mail-Adresse, nur den Anzeigenamen»).
--
-- Grenze bleibt die Mitgliedschaft (#425 AK 4): `team_mitglieder` prüft wie
-- bisher als erste Anweisung, dass der Aufrufer dem Team angehört, und liefert
-- nur dessen aktuelle Mitglieder. Ehemalige stehen nicht in `team_members` und
-- bekommen hier also keine Adresse; ihre Namen an vergangenen Terminen kommen
-- weiter allein aus `verantwortlich_name`.
--
-- Die Adresse wird nicht in `profiles` gespiegelt, sondern live aus
-- `auth.users` gelesen (SECURITY DEFINER) — so gibt es keinen Abgleich, der
-- nach einem Adresswechsel driften könnte.
--
-- Der KI-Assistent bekommt die Adresse nicht (#425 OoS 1): Sein Werkzeug
-- «team_mitglieder_abrufen» bildet nur Kennung und Anzeigename ab.
-- ============================================================================

create or replace function team_mitglieder(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = auth.uid()) then
    raise exception 'not a member of this team';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'anzeige_name', anzeige_name(m.user_id),
           'email', u.email)
           order by m.created_at)
    from team_members m
    join auth.users u on u.id = m.user_id
    where m.team_id = p_team), '[]'::jsonb);
end;
$$;
revoke all on function team_mitglieder(uuid) from public, anon;
grant execute on function team_mitglieder(uuid) to authenticated;
