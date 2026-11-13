-- Eindeutigkeit je Verein (Story 2 #578, Epic #575; Architekturplan Vereine
-- §3.3 a, §4.1, §4.4).
--
-- Vorname, Nachname und Jahrgang sind je Verein eindeutig, nach dem Schlüssel
-- `spieler_text_schluessel` (dieselbe Regel wie bisher je Team, AK 2). Statt
-- eines eindeutigen Index prüft der Trigger `spieler_vorher` unter der
-- Vereinssperre: beim INSERT und, wenn sich der Schlüssel wirklich ändert,
-- beim UPDATE. So bleiben bestehende Doppeleinträge getrennt und änderbar,
-- solange ihr Schlüssel gleich bleibt (AK 7, PC 1). Die RPCs prüfen vorab mit
-- `spieler_doppelt` und antworten mit einem `jsonb`-Status samt Teams der
-- bestehenden Spieler:in (AK 3–6); `SPIELER_DOPPELT` aus dem Trigger ist nur
-- das Netz für das Rennen (AK 8). Doppel vor Grenzen (AK 9): Die RPC prüft
-- vor jedem Schreiben, der Trigger vor der Vereinsgrenze; die Teamgrenze
-- prüft danach `team_spieler_vorher`.
--
-- Nur Spieler:innen des eigenen Vereins (PC 2); ein Status nennt höchstens
-- Teamnamen, nie J+S-Nummer, Link oder Kennungen (PC 3).
--
-- Der Import in ein Team (`spieler_importieren`) bleibt unverändert (OoS 3,
-- entfällt mit Story 9): Eine neue Zeile, die eine Spieler:in eines anderen
-- Teams trifft, lässt die Übernahme am Netz `SPIELER_DOPPELT` als Ganzes
-- scheitern.

set lock_timeout = '5s';

-- ── Index ───────────────────────────────────────────────────────────────────

-- Nicht eindeutig, nur für die Suche im Verein (spieler_doppelt, Trigger).
create index spieler_schluessel_verein on spieler
  (verein_id, spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang);
-- Je Team (20261016100000_spielerliste.sql); die Regel je Verein schliesst ihn ein.
drop index spieler_eindeutig;

-- ── Funktionen ──────────────────────────────────────────────────────────────

-- Treffer im Verein über den Schlüssel, ohne `p_ausser` (die Spieler:in, die
-- sich ändert). Liefert null oder `{teams, team_ids, ohne_team}` über alle
-- Treffer (Altdubletten können mehrere sein), Teams nach Namen. `team_ids`
-- bleibt intern: Die RPCs leiten daraus `eigenes_team` ab und geben nur die
-- Namen weiter (PC 3). Kein API-Recht.
create function spieler_doppelt(p_verein uuid, p_vorname text, p_nachname text, p_jahrgang integer,
                                p_ausser uuid default null)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  with treffer as (
    select s.id from spieler s
     where s.verein_id = p_verein
       and spieler_text_schluessel(s.vorname) = spieler_text_schluessel(p_vorname)
       and spieler_text_schluessel(s.nachname) = spieler_text_schluessel(p_nachname)
       and s.jahrgang = p_jahrgang
       and s.id is distinct from p_ausser
  ), ihre_teams as (
    select distinct t.id, t.name from treffer x
      join team_spieler ts on ts.spieler_id = x.id
      join teams t on t.id = ts.team_id
  )
  select case when exists (select 1 from treffer) then jsonb_build_object(
    'teams', coalesce((select jsonb_agg(name order by name, id) from ihre_teams), '[]'::jsonb),
    'team_ids', coalesce((select jsonb_agg(id order by name, id) from ihre_teams), '[]'::jsonb),
    'ohne_team', exists (select 1 from treffer x
                          where not exists (select 1 from team_spieler ts where ts.spieler_id = x.id)))
  end;
$$;

-- Der Status einer Abweisung aus `spieler_doppelt`, aus Sicht von `p_team`
-- (AP §4.4, §5.2). Kein API-Recht.
create function spieler_doppelt_status(p_doppelt jsonb, p_team uuid) returns jsonb
language sql immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object('status', 'abgewiesen', 'grund', 'doppelt',
                            'eigenes_team', p_doppelt -> 'team_ids' ? p_team::text,
                            'teams', p_doppelt -> 'teams', 'ohne_team', p_doppelt -> 'ohne_team');
$$;

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql, ergänzt um den
-- Schlüssel je Verein (AP §3.3 a): beim INSERT vor der Vereinsgrenze (AK 9),
-- beim UPDATE OF vorname, nachname, jahrgang nur, wenn sich der Schlüssel
-- ändert (AK 7). Der Trigger sieht unter READ COMMITTED alles, was vor dem
-- Erhalt der Vereinssperre committet wurde (eigene Anweisung einer
-- VOLATILE-Funktion), darum gewinnt im Rennen genau eine Eingabe (AK 8).
create or replace function spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_teams uuid[];
  v_team uuid;
begin
  if tg_op = 'INSERT' then
    if new.verein_id is null then raise exception 'VEREIN_FEHLT'; end if;
    perform sperre_verein(new.verein_id);
    if spieler_doppelt(new.verein_id, new.vorname, new.nachname, new.jahrgang, new.id) is not null then
      raise exception 'SPIELER_DOPPELT';
    end if;
    if (select count(*) from spieler where verein_id = new.verein_id) >= 1000 then
      raise exception 'VEREIN_VOLL';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if spieler_text_schluessel(new.vorname) = spieler_text_schluessel(old.vorname)
       and spieler_text_schluessel(new.nachname) = spieler_text_schluessel(old.nachname)
       and new.jahrgang = old.jahrgang then
      return new;
    end if;
    perform sperre_verein(new.verein_id);
    if spieler_doppelt(new.verein_id, new.vorname, new.nachname, new.jahrgang, new.id) is not null then
      raise exception 'SPIELER_DOPPELT';
    end if;
    return new;
  end if;
  v_teams := array(select ts.team_id from team_spieler ts join teams t on t.id = ts.team_id
                    where ts.spieler_id = old.id order by ts.team_id);
  if cardinality(v_teams) = 0 then return old; end if;
  if old.verein_id is not null then perform sperre_verein(old.verein_id); end if;
  perform sperre_teams(v_teams);
  foreach v_team in array v_teams loop
    perform termine_einfrieren(v_team);
  end loop;
  return old;
end;
$$;

-- Rumpf wie in 20261113110000_spieler_ueber_zuordnung.sql; unter Verein- und
-- Teamsperre zuerst `spieler_doppelt`, noch vor `spielerzahl_freigeben` und
-- jedem Schreiben (AK 9): Eine Abweisung ist ein Status, keine Exception, und
-- darf nichts hinterlassen. Danach die Grenzen 100/1000 aus den Triggern.
create or replace function spieler_aufnehmen(p_team uuid, p_vorname text, p_nachname text, p_jahrgang integer, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_verein uuid;
  v_doppelt jsonb;
  v_ersetzt int := 0;
  v_js text := nullif(btrim(coalesce(p_js, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  select verein_id into v_verein from teams where id = p_team;
  perform sperre_verein(v_verein);
  perform sperre_teams(array[p_team]);
  v_doppelt := spieler_doppelt(v_verein, p_vorname, p_nachname, p_jahrgang);
  if v_doppelt is not null then return spieler_doppelt_status(v_doppelt, p_team); end if;
  v_ersetzt := spielerzahl_freigeben(p_team);
  insert into spieler (team_id, verein_id, vorname, nachname, jahrgang, js_nummer)
    values (p_team, v_verein, spieler_text_bereinigt(p_vorname), spieler_text_bereinigt(p_nachname), p_jahrgang, v_js)
    returning id into v_id;
  insert into team_spieler (team_id, spieler_id, verein_id) values (p_team, v_id, v_verein);
  return jsonb_build_object('id', v_id, 'ersetzt', v_ersetzt);
end;
$$;

-- Ändern am Team-Ort (AP §4.4): mit `p_team`, Rückgabe `jsonb` statt `void`
-- (20261016100000_spielerliste.sql). Ein Name wirkt überall, auch an
-- vergangenen Terminen. Sperrordnung Verein → `spieler`-Zeile. Nur wenn sich
-- der Schlüssel ändert, prüft `spieler_doppelt` gegen alle anderen im Verein
-- (AK 5, 6); gleicher Schlüssel geht immer, auch bei Altdubletten (AK 7).
drop function spieler_aendern(uuid, text, text, int, text);
create function spieler_aendern(p_team uuid, p_spieler uuid, p_vorname text, p_nachname text, p_jahrgang int, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_verein uuid;
  v_alt spieler%rowtype;
  v_doppelt jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) or not spieler_im_team(p_spieler, p_team) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  select verein_id into v_verein from teams where id = p_team;
  perform sperre_verein(v_verein);
  select * into v_alt from spieler where id = p_spieler for update;
  if not found then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  if spieler_text_schluessel(p_vorname) is distinct from spieler_text_schluessel(v_alt.vorname)
     or spieler_text_schluessel(p_nachname) is distinct from spieler_text_schluessel(v_alt.nachname)
     or p_jahrgang is distinct from v_alt.jahrgang then
    v_doppelt := spieler_doppelt(v_verein, p_vorname, p_nachname, p_jahrgang, p_spieler);
    if v_doppelt is not null then return spieler_doppelt_status(v_doppelt, p_team); end if;
  end if;
  update spieler set vorname = spieler_text_bereinigt(p_vorname), nachname = spieler_text_bereinigt(p_nachname),
                     jahrgang = p_jahrgang, js_nummer = nullif(btrim(coalesce(p_js, '')), '')
   where id = p_spieler;
  return jsonb_build_object('status', 'geaendert');
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────

-- Neu mit UPDATE OF vorname, nachname, jahrgang (AP §3.3 a, §5.4).
drop trigger spieler_vorher on spieler;
create trigger spieler_vorher before insert or delete or update of vorname, nachname, jahrgang on spieler
  for each row execute function spieler_vorher();

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function spieler_doppelt(uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke all on function spieler_doppelt_status(jsonb, uuid) from public, anon, authenticated;
revoke all on function spieler_aendern(uuid, uuid, text, text, int, text) from public, anon;
grant execute on function spieler_aendern(uuid, uuid, text, text, int, text) to authenticated;

reset lock_timeout;
