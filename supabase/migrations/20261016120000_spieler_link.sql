-- ============================================================================
-- Abmeldungen der Spieler:innen (Epic #433), Story 3 (#436): ein privater Link
-- je Spieler:in, über den ihre Spielervertretung sie ohne Konto ab- und wieder
-- anmeldet.
--
-- Der Link trägt ein Geheimnis wie das Kalender-Abo (244 Bit, im Klartext,
-- weil Mitglieder ihn jederzeit wieder holen): Wer ihn hat, sieht die
-- anstehenden Termine des Teams mit der Zahl der Angemeldeten und meldet diese
-- eine Spieler:in ab und an. Lesbar ist das Geheimnis nicht über die Tabelle
-- — eine Spielerliste (auch die des KI-Assistenten) gibt es nie preis —,
-- sondern nur über `spieler_link_holen`.
--
-- Erneuern ersetzt den Wert: Der alte gilt nie wieder, die Abmeldungen
-- bleiben (sie hängen an der Spieler:in). Ungültig, erneuert, entfernt oder
-- unbekannt antworten gleich (`{"gueltig": false}`, AK 11).
-- ============================================================================
set lock_timeout = '5s';

alter table spieler add column link_token text not null unique
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- Das Geheimnis per Spaltenrecht aus dem Lesen nehmen.
revoke select on spieler from authenticated;
grant select (id, team_id, vorname, nachname, jahrgang, js_nummer, created_at) on spieler to authenticated;

-- ── Mitglieder: holen und erneuern (AK 1, 3, 12) ────────────────────────────

create function spieler_link_holen(p_spieler uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into s from spieler where id = p_spieler;
  if not found or not ist_team_mitglied(s.team_id) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return s.link_token;
end;
$$;

create function spieler_link_erneuern(p_spieler uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  update spieler set link_token = v_token where id = p_spieler;
  return v_token;
end;
$$;
revoke all on function spieler_link_holen(uuid) from public, anon;
revoke all on function spieler_link_erneuern(uuid) from public, anon;
grant execute on function spieler_link_holen(uuid) to authenticated;
grant execute on function spieler_link_erneuern(uuid) to authenticated;

-- ── Ohne Konto: ansehen und ab- und anmelden (AK 4–9, 11, 12) ───────────────

-- Was die Spielervertretung sieht: Teamname, Vor- und Nachname ihrer
-- Spieler:in und die anstehenden Termine des Teams — ab heute, ein begonnener
-- bis Ende seines Tages (AK 9) — mit Zeit, Ort, ob er ausfällt, wie viele
-- angemeldet sind und ob ihre Spieler:in abgemeldet ist. Keine Namen anderer,
-- kein Training, nichts Vergangenes (OoS 2).
create function spieler_link_ansicht(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
  v_team text;
begin
  select * into s from spieler where link_token = p_token;
  if not found then return jsonb_build_object('gueltig', false); end if;
  select name into v_team from teams where id = s.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', v_team,
    'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'ausgefallen', t.ausgefallen,
               'begonnen', termin_begonnen(t.datum, t.beginn),
               'angemeldet', case when t.ausgefallen then null else (spielstand(t) ->> 'angemeldet')::int end,
               'abgemeldet', case
                 when exists (select 1 from termin_eingefroren f where f.termin_id = t.id) then
                   coalesce((select p.abgemeldet from termin_teilnahmen p where p.termin_id = t.id and p.spieler_id = s.id), false)
                 else exists (select 1 from termin_abmeldungen a where a.termin_id = t.id and a.spieler_id = s.id)
               end)
             order by t.datum, t.beginn, t.created_at)
        from training_termine t
       where t.team_id = s.team_id and t.datum >= heute_am_trainingsort()), '[]'::jsonb));
end;
$$;

-- Ab- und Anmelden über den Link: dieselbe Regel wie für Mitglieder
-- (`abmeldung_anwenden`), die Spieler:in ergibt sich aus dem Link.
create function spieler_link_abmelden(p_token text, p_termin uuid, p_abgemeldet boolean,
                                      p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_spieler uuid;
begin
  select id into v_spieler from spieler where link_token = p_token;
  if v_spieler is null then return jsonb_build_object('status', 'ungueltig'); end if;
  return abmeldung_anwenden(p_termin, v_spieler, p_abgemeldet, p_gesehen_datum, p_gesehen_beginn);
end;
$$;
revoke all on function spieler_link_ansicht(text) from public;
revoke all on function spieler_link_abmelden(text, uuid, boolean, date, time) from public;
grant execute on function spieler_link_ansicht(text) to anon, authenticated;
grant execute on function spieler_link_abmelden(text, uuid, boolean, date, time) to anon, authenticated;

reset lock_timeout;
