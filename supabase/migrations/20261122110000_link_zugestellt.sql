-- #657 (Epic #655): Link als zugestellt markieren.
--
-- Der Stand des privaten Links je Spieler:in (PC 1, teamübergreifend) ist
-- abgeholt | zugestellt | offen. «abgeholt» ist die bestehende Spalte
-- `link_bezogen` (Name bleibt wegen des Sync), «zugestellt» die neue Spalte
-- `link_zugestellt`: Trainer:in oder Verwaltung hat den Link ausserhalb von
-- KiFu weitergegeben. Wann, hält KiFu nicht fest (Epic Out of Scope 1),
-- darum ein boolean. Abgeholt hat Vorrang; die Ableitung steht einmal in
-- `linkStandAus` (web/lib/spieler.ts), der Trigger unten ist ihr Zwilling.
--
-- - Spalte nullable mit Default false, ohne NOT NULL/CHECK (CLAUDE.md: bis
--   N1 lädt der Sync Prod-Zeilen ohne sie). Leser werten `is true`. Nur
--   Lese-Grant; geschrieben wird nur über die RPCs unten.
-- - Trigger `spieler_link_zugestellt_fallen`: Abholen (link_bezogen wird
--   true, PC 2) und jedes Erneuern (neuer link_token, PC 3) setzen
--   «zugestellt» zurück. Er ist die einzige Stelle dafür; abholung_abholen,
--   spieler_link_erneuern und verein_spieler_link_erneuern bleiben
--   unverändert, abholung_erneuern berührt spieler nicht.
-- - `link_zugestellt_kern`: setzt bzw. nimmt zurück, nur solange der Link
--   nicht abgeholt ist (AK 1, 2), idempotent. Ohne Rollenprädikat und ohne
--   API-Recht; die Rechteprüfung tragen die zwei Orte:
-- - Team-Ort `spieler_link_zugestellt_setzen(p_team, p_spieler, …)` (AK 1,
--   3 über den KI-Kern) nach dem Muster spieler_link_erneuern: Team-Mitglied
--   und Spieler:in im Team, sonst SPIELER_NICHT_GEFUNDEN; Sperrfolge Team →
--   `spieler`-Zeile.
-- - Verein-Ort `verein_spieler_link_zugestellt_setzen(p_spieler, …)` (AK 2):
--   nur_in_der_anwendung, verwaltung_spieler_sperren (Verein → Zeile).
-- - Leser additiv: verein_spielerliste liefert der Verwaltung zusätzlich
--   `link_zugestellt`, verein_spieler_link_holen `zugestellt`. Die
--   Schlüssel `link_bezogen`/`bezogen` bleiben bis N1 (altes Bundle).
--
-- Rückgabe beider RPCs: {link_stand: 'abgeholt'|'zugestellt'|'offen', geaendert}.
-- `geaendert` false heisst: Der Link war schon abgeholt, nichts geschrieben.

set lock_timeout = '5s';

-- ── Spalte ──────────────────────────────────────────────────────────────────

alter table spieler add column link_zugestellt boolean default false;
grant select (link_zugestellt) on spieler to authenticated;

-- ── Trigger: Abholen und Erneuern setzen «zugestellt» zurück (PC 2, 3) ───────

create function spieler_link_zugestellt_fallen() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.link_bezogen is true or new.link_token is distinct from old.link_token then
    new.link_zugestellt := false;
  end if;
  return new;
end;
$$;

revoke all on function spieler_link_zugestellt_fallen() from public, anon, authenticated;

create trigger spieler_link_zugestellt_fallen
  before update of link_bezogen, link_token on spieler
  for each row execute function spieler_link_zugestellt_fallen();

-- ── Kern ────────────────────────────────────────────────────────────────────

-- Die Zeile sperren (die Orte haben Team bzw. Verein schon gesperrt); fehlt
-- sie, SPIELER_NICHT_GEFUNDEN. Abgeholt: nichts schreiben. Kein API-Recht.
create function link_zugestellt_kern(p_spieler uuid, p_zugestellt boolean) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bezogen boolean;
begin
  select link_bezogen into v_bezogen from spieler where id = p_spieler for update;
  if not found then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  if v_bezogen then
    return jsonb_build_object('link_stand', 'abgeholt', 'geaendert', false);
  end if;
  update spieler set link_zugestellt = coalesce(p_zugestellt, false) where id = p_spieler;
  return jsonb_build_object('link_stand', case when p_zugestellt then 'zugestellt' else 'offen' end,
                            'geaendert', true);
end;
$$;

revoke all on function link_zugestellt_kern(uuid, boolean) from public, anon, authenticated;

-- ── Team-Ort (AK 1, 3) ──────────────────────────────────────────────────────

-- Sperrfolge wie spieler_link_erneuern: Team → `spieler`-Zeile, danach die
-- Zuordnung erneut prüfen.
create function spieler_link_zugestellt_setzen(p_team uuid, p_spieler uuid, p_zugestellt boolean) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  perform sperre_teams(array[p_team]);
  perform 1 from spieler where id = p_spieler for update;
  if not spieler_im_team(p_spieler, p_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return link_zugestellt_kern(p_spieler, p_zugestellt);
end;
$$;

revoke all on function spieler_link_zugestellt_setzen(uuid, uuid, boolean) from public, anon;
grant execute on function spieler_link_zugestellt_setzen(uuid, uuid, boolean) to authenticated;

-- ── Verein-Ort (AK 2) ───────────────────────────────────────────────────────

-- Sperrfolge Verein → `spieler`-Zeile (im Kern).
create function verein_spieler_link_zugestellt_setzen(p_spieler uuid, p_zugestellt boolean) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  perform verwaltung_spieler_sperren(p_spieler);
  return link_zugestellt_kern(p_spieler, p_zugestellt);
end;
$$;

revoke all on function verein_spieler_link_zugestellt_setzen(uuid, boolean) from public, anon;
grant execute on function verein_spieler_link_zugestellt_setzen(uuid, boolean) to authenticated;

-- ── Leser ───────────────────────────────────────────────────────────────────

-- Rumpf wie in 20261114210000_spielerbestand_verwaltung.sql; dazu `zugestellt`.
--   {link_token, ohne_team, bezogen, zugestellt}
create or replace function verein_spieler_link_holen(p_spieler uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  s spieler;
begin
  perform nur_in_der_anwendung();
  select * into s from spieler where id = p_spieler;
  if not found or not ist_verein_verwaltung(s.verein_id) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object('link_token', s.link_token,
                            'ohne_team', not exists (select 1 from team_spieler ts where ts.spieler_id = s.id),
                            'bezogen', s.link_bezogen,
                            'zugestellt', s.link_zugestellt is true);
end;
$$;

-- Rumpf wie in 20261115100000_verein_spielerliste.sql; im Verwaltungszweig
-- dazu `link_zugestellt`.
create or replace function verein_spielerliste(p_verein uuid, p_suche text default null, p_teams uuid[] default null,
                                               p_ohne_team boolean default false, p_jahrgaenge integer[] default null)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_verwaltung boolean;
  v_suche text;
  v_teams uuid[];
  v_ohne boolean := coalesce(p_ohne_team, false);
  v_jahrgaenge integer[];
begin
  perform nur_in_der_anwendung();
  if not ist_verein_mitglied(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  v_verwaltung := ist_verein_verwaltung(p_verein);
  v_suche := nullif(lower(unaccent(spieler_text_bereinigt(p_suche))), '');
  v_teams := nullif(array_remove(p_teams, null), '{}');
  v_jahrgaenge := nullif(array_remove(p_jahrgaenge, null), '{}');

  return (
    with treffer as (
      select s.*
        from spieler s
       where s.verein_id = p_verein
         and (v_suche is null or strpos(lower(unaccent(s.vorname || ' ' || s.nachname)), v_suche) > 0)
         and ((v_teams is null and not v_ohne)
              or (v_teams is not null
                  and exists (select 1 from team_spieler ts where ts.spieler_id = s.id and ts.team_id = any(v_teams)))
              or (v_ohne and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)))
         and (v_jahrgaenge is null or s.jahrgang = any(v_jahrgaenge))
    )
    select jsonb_build_object(
      'spieler', (select coalesce(jsonb_agg(
                    jsonb_build_object(
                      'id', s.id, 'vorname', s.vorname, 'nachname', s.nachname, 'jahrgang', s.jahrgang,
                      'teams', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                                                          order by t.name, t.id), '[]'::jsonb)
                                  from team_spieler ts join teams t on t.id = ts.team_id
                                 where ts.spieler_id = s.id))
                    || case when v_verwaltung then jsonb_build_object(
                         'js', s.js_nummer, 'link_bezogen', s.link_bezogen,
                         'link_zugestellt', s.link_zugestellt is true,
                         'schnuppern', (select jsonb_build_object('team_id', ts.team_id) || team_probe_zaehler(ts.team_id, s.id)
                                          from team_spieler ts
                                         where ts.spieler_id = s.id and ts.probe_seit is not null
                                         order by ts.created_at, ts.team_id limit 1))
                       else '{}'::jsonb end
                    order by s.vorname, s.nachname, s.jahrgang, s.id), '[]'::jsonb)
                    from treffer s),
      'teams', (select coalesce(jsonb_agg(
                  jsonb_build_object('id', t.id, 'name', t.name)
                  || case when v_verwaltung
                          then jsonb_build_object('anzahl', (select count(*) from team_spieler ts where ts.team_id = t.id))
                          else '{}'::jsonb end
                  order by t.name, t.id), '[]'::jsonb)
                  from teams t where t.verein_id = p_verein),
      'jahrgaenge', (select coalesce(jsonb_agg(j.jahrgang order by j.jahrgang), '[]'::jsonb)
                       from (select distinct s.jahrgang from spieler s where s.verein_id = p_verein) j),
      'gesamt', (select count(*) from spieler s where s.verein_id = p_verein),
      'ohne_team', (select count(*) from spieler s
                     where s.verein_id = p_verein
                       and not exists (select 1 from team_spieler ts where ts.spieler_id = s.id)),
      'verwaltung', v_verwaltung));
end;
$$;
