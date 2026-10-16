-- ============================================================================
-- Abmeldungen der Spieler:innen (Epic #433), Story 1 (#434): die Spielerliste
-- eines Teams — Vorname, Nachname, Jahrgang und optional die J+S-Nummer je
-- Spieler:in. Sobald die Liste jemanden enthält, ersetzt sie an anstehenden
-- Terminen die erwartete Spielerzahl (AK 8, 9).
--
-- Der Stand eines begonnenen Termins bleibt, wie er bei Beginn war (#435 PC 1,
-- #434 PC 3). Einen Zeitplaner gibt es nicht; darum gilt: Ein begonnener
-- Termin, an dessen Eingaben sich seit Beginn nichts geändert hat, ist live
-- richtig berechnet. Jedes Schreiben, das die Eingaben ändert — die
-- Spielerliste (hier), die Abmeldungen (#435) oder den Zeitpunkt des Termins
-- —, hält vorher den Stand aller betroffenen begonnenen Termine fest
-- (`termin_eingefroren`, `termin_teilnahmen`). Gelesen wird nie geschrieben.
--
-- Wer aus der Liste fällt, wird wirklich gelöscht (Epic EK 9): An festgehalte-
-- nen Terminen steht er danach als Zeile ohne Spieler:in da — «ehemalige
-- Spieler:in» (#435 PC 4). Namensänderungen wirken überall, auch an vergange-
-- nen Terminen, weil die Namen nur in `spieler` stehen (#435 PC 3).
--
-- Forward-only: nur neue Tabellen und Funktionen; an `training_termine` und
-- `termin_serien` kommen Trigger dazu, keine verschärfte Spalte. Neue Tabellen
-- stehen in PUBLIC_TABLES (sync-staging.yml).
-- ============================================================================
set lock_timeout = '5s';

-- ── Zeit und Schreibweise ───────────────────────────────────────────────────

-- Hat der Termin begonnen? Minutengenau, an der Uhr am Trainingsort (wie
-- heute_am_trainingsort). Zwilling: terminBegonnen in web/lib/zeit.ts.
create function termin_begonnen(p_datum date, p_beginn time) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Europe/Zurich') >= (p_datum + p_beginn);
$$;
revoke all on function termin_begonnen(date, time) from public, anon, authenticated;

-- Die gespeicherte Form eines Namens: Unicode NFC (zerlegte Eingabe vom Mac),
-- jeder Leerraum ein Leerzeichen, aussen keiner. Zwilling: bereinigeName in
-- web/lib/spieler.ts.
create function spieler_text_bereinigt(p text) returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(normalize(p, NFC), '[[:space:]   ]+', ' ', 'g'));
$$;

-- Der Schlüssel, an dem zwei Angaben als dieselbe Spieler:in gelten (#434 AK 6,
-- #438 PO 5): Gross/Klein, überzählige Leerzeichen, Bindestrich gegen
-- Leerzeichen und Apostroph-Varianten unterscheiden nicht; Umlaute und
-- Akzente schon. Dieselbe Regel für die Eindeutigkeit und die Selbstabholung.
create function spieler_text_schluessel(p text) returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select lower(btrim(regexp_replace(
    regexp_replace(translate(spieler_text_bereinigt(p), '’‘ʼ´′`', repeat('''', 6)), '[-‐‑‒–—−]', ' ', 'g'),
    ' +', ' ', 'g')));
$$;
revoke all on function spieler_text_bereinigt(text) from public, anon, authenticated;
revoke all on function spieler_text_schluessel(text) from public, anon, authenticated;

-- ── Spielerliste ────────────────────────────────────────────────────────────

create table spieler (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  vorname text not null,
  nachname text not null,
  jahrgang smallint not null,
  js_nummer text,
  created_at timestamptz not null default now(),
  -- Zwillinge: NAME_MAX, JS_MAX, JAHRGANG_MIN/MAX in web/lib/spieler.ts. Die
  -- Namen sind die Marker der Klartext-Meldungen (lib/training-bedingungen.ts).
  constraint spieler_vorname check (vorname = spieler_text_bereinigt(vorname) and char_length(vorname) between 1 and 60),
  constraint spieler_nachname check (nachname = spieler_text_bereinigt(nachname) and char_length(nachname) between 1 and 60),
  constraint spieler_jahrgang check (jahrgang between 1000 and 9999),
  constraint spieler_js check (js_nummer is null or (js_nummer = btrim(js_nummer) and char_length(js_nummer) between 1 and 20))
);
create unique index spieler_eindeutig on spieler
  (team_id, spieler_text_schluessel(vorname), spieler_text_schluessel(nachname), jahrgang);

comment on table spieler is
  'Spielerliste eines Teams (#434): Vorname, Nachname, Jahrgang, optional J+S-Nummer. Geschrieben nur über die RPCs spieler_*.';

alter table spieler enable row level security;
create policy sp_select on spieler for select to authenticated using (ist_team_mitglied(team_id));
-- Die API-Rollen erhalten per Default alle Rechte; erst alle nehmen, dann nur
-- Lesen. Geschrieben wird ausschliesslich über die RPCs unten.
revoke all on spieler from anon, authenticated;
grant select on spieler to authenticated;

-- ── Festgehaltener Stand begonnener Termine ─────────────────────────────────

create table termin_eingefroren (
  termin_id uuid primary key references training_termine(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  eingefroren_am timestamptz not null default now()
);
create index termin_eingefroren_team_idx on termin_eingefroren (team_id);

-- Je festgehaltenem Termin eine Zeile pro Spieler:in, die bei Beginn auf der
-- Liste stand. Fällt sie später aus der Liste, bleibt die Zeile ohne
-- Spieler:in stehen: die ehemalige Spieler:in ohne Namen (#435 PC 4).
create table termin_teilnahmen (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references termin_eingefroren(termin_id) on delete cascade,
  team_id uuid not null,
  spieler_id uuid references spieler(id) on delete set null,
  abgemeldet boolean not null default false,
  unique (termin_id, spieler_id)
);
create index termin_teilnahmen_spieler_idx on termin_teilnahmen (spieler_id);

alter table termin_eingefroren enable row level security;
alter table termin_teilnahmen enable row level security;
create policy te_select on termin_eingefroren for select to authenticated using (ist_team_mitglied(team_id));
create policy tn_select on termin_teilnahmen for select to authenticated using (ist_team_mitglied(team_id));
revoke all on termin_eingefroren from anon, authenticated;
revoke all on termin_teilnahmen from anon, authenticated;
grant select on termin_eingefroren to authenticated;
grant select on termin_teilnahmen to authenticated;

-- Den Stand EINES Termins festhalten, falls er begonnen hat und noch nicht
-- festgehalten ist. Ohne Spielerliste gibt es nichts festzuhalten: Kommt
-- später die erste Spieler:in, hält `termine_einfrieren` vorher alle
-- begonnenen Termine fest (leer).
create function termin_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not exists (select 1 from spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id) values (p_termin, v_team)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into termin_teilnahmen (termin_id, team_id, spieler_id)
    select p_termin, v_team, s.id from spieler s where s.team_id = v_team;
end;
$$;

-- Den Stand ALLER begonnenen, noch offenen Termine eines Teams festhalten —
-- vor jeder Änderung der Spielerliste.
create function termine_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id)
      select t.id, t.team_id from training_termine t
       where t.team_id = p_team
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id)
  insert into termin_teilnahmen (termin_id, team_id, spieler_id)
    select n.termin_id, p_team, s.id from neu n cross join spieler s where s.team_id = p_team;
end;
$$;
revoke all on function termin_einfrieren(uuid) from public, anon, authenticated;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- Vor dem Aufnehmen: höchstens 200 je Team (AK 7) — die Sperre je Team
-- schliesst das Wettrennen zweier gleichzeitiger Aufnahmen aus — und den
-- Stand der begonnenen Termine festhalten (die neue Spieler:in zählt dort
-- nicht). Vor dem Entfernen ebenso: Wer bei Beginn da war, bleibt dort
-- (ehemalig). Beim Auflösen des Teams nicht — es geht alles mit.
create function spieler_vorher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid := case when tg_op = 'DELETE' then old.team_id else new.team_id end;
begin
  if tg_op = 'DELETE' and not exists (select 1 from teams where id = v_team) then return old; end if;
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  if tg_op = 'INSERT' and (select count(*) from spieler where team_id = v_team) >= 200 then
    raise exception 'SPIELERLISTE_VOLL';
  end if;
  perform termine_einfrieren(v_team);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger spieler_vorher before insert or delete on spieler
  for each row execute function spieler_vorher();
-- Eine Spieler:in wechselt nie das Team.
create function spieler_team_fest() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.team_id is distinct from old.team_id then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  return new;
end;
$$;
create trigger spieler_team_fest before update of team_id on spieler
  for each row execute function spieler_team_fest();

-- Ein Termin, der beim Festlegen schon begonnen hat, hält sofort fest (#435
-- PC 2). Wird ein Termin verlegt, entscheidet allein der neue Zeitpunkt:
-- begonnen → festhalten (falls noch offen), noch nicht begonnen → wieder
-- offen. Das fängt jeden Weg, auch die Serienrechnung und
-- termin_der_serie_folgen — alle schreiben `training_termine`.
create function termin_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if termin_begonnen(new.datum, new.beginn) then
    perform termin_einfrieren(new.id);
  elsif tg_op = 'UPDATE' then
    delete from termin_eingefroren where termin_id = new.id;
  end if;
  return null;
end;
$$;
create trigger termin_zeitpunkt_neu after insert on training_termine
  for each row execute function termin_zeitpunkt_nachher();
create trigger termin_zeitpunkt_geaendert after update of datum, beginn on training_termine
  for each row
  when (old.datum is distinct from new.datum or old.beginn is distinct from new.beginn)
  execute function termin_zeitpunkt_nachher();

-- ── Die Spielerliste ersetzt die erwartete Zahl (AK 8, 9, PC 2) ─────────────

-- Führt das Team eine Spielerliste, nimmt ein anstehender Termin (und jede
-- Serie) keine erwartete Zahl von Hand an. Ein begonnener Termin schon: Dort
-- gilt die erwartete Zahl, wenn die Liste bei Beginn leer war. Wird ein
-- vergangener Termin in die Zukunft verlegt, verliert er seine alte Zahl —
-- sonst tauchte sie wieder auf, sobald die Liste leer wird (PC 2).
create function termin_spielerzahl_regel() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.erwartete_spielerzahl is null
     or not exists (select 1 from spieler where team_id = new.team_id)
     or termin_begonnen(new.datum, new.beginn) then
    return new;
  end if;
  if tg_op = 'INSERT' or new.erwartete_spielerzahl is distinct from old.erwartete_spielerzahl then
    raise exception 'SPIELERLISTE_FUEHRT_ZAHL';
  end if;
  new.erwartete_spielerzahl := null;
  new.spielerzahl_abweichend := false;
  return new;
end;
$$;
create trigger termin_spielerzahl_regel before insert or update on training_termine
  for each row execute function termin_spielerzahl_regel();

create function serie_spielerzahl_regel() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.erwartete_spielerzahl is not null
     and (tg_op = 'INSERT' or new.erwartete_spielerzahl is distinct from old.erwartete_spielerzahl)
     and exists (select 1 from spieler where team_id = new.team_id) then
    raise exception 'SPIELERLISTE_FUEHRT_ZAHL';
  end if;
  return new;
end;
$$;
create trigger serie_spielerzahl_regel before insert or update of erwartete_spielerzahl on termin_serien
  for each row execute function serie_spielerzahl_regel();
revoke all on function spieler_vorher() from public, anon, authenticated;
revoke all on function spieler_team_fest() from public, anon, authenticated;
revoke all on function termin_zeitpunkt_nachher() from public, anon, authenticated;
revoke all on function termin_spielerzahl_regel() from public, anon, authenticated;
revoke all on function serie_spielerzahl_regel() from public, anon, authenticated;

-- ── Lesen ───────────────────────────────────────────────────────────────────

-- Die Spielerzahl eines Termins aus der Liste — als berechnetes Feld lesbar
-- (`spielstand` im Select des Plans). `null`: Die Liste ist (bzw. war bei
-- Beginn) leer; dann gilt die erwartete Zahl. Festgehaltene Termine zählen
-- ihren Stand, offene die aktuelle Liste. `angemeldet` zieht ab #435 die
-- Abmeldungen ab.
create function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.n > 0 then jsonb_build_object('gesamt', z.n, 'angemeldet', z.n, 'eingefroren', z.fest) end
    from (select e.fest,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      else (select count(*) from spieler s where s.team_id = t.team_id) end as n
            from (select exists (select 1 from termin_eingefroren f where f.termin_id = t.id) as fest) e) z;
$$;
revoke all on function spielstand(training_termine) from public, anon;
grant execute on function spielstand(training_termine) to authenticated;

-- ── Schreiben ───────────────────────────────────────────────────────────────

-- Aufnehmen (AK 1, 6, 7). Die erste Spieler:in ersetzt die erwarteten Zahlen:
-- Anstehende Termine und alle Serien des Teams verlieren sie (PC 2) — sonst
-- tauchten sie wieder auf, sobald die Liste leer wird. Wie viele es waren,
-- meldet `ersetzt`.
create function spieler_aufnehmen(p_team uuid, p_vorname text, p_nachname text, p_jahrgang int, p_js text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_ersetzt int := 0;
  v_js text := nullif(btrim(coalesce(p_js, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || p_team::text, 0));
  if not exists (select 1 from spieler where team_id = p_team) then
    update training_termine set erwartete_spielerzahl = null, spielerzahl_abweichend = false
     where team_id = p_team and erwartete_spielerzahl is not null and not termin_begonnen(datum, beginn);
    get diagnostics v_ersetzt = row_count;
    update termin_serien set erwartete_spielerzahl = null
     where team_id = p_team and erwartete_spielerzahl is not null;
  end if;
  begin
    insert into spieler (team_id, vorname, nachname, jahrgang, js_nummer)
      values (p_team, spieler_text_bereinigt(p_vorname), spieler_text_bereinigt(p_nachname), p_jahrgang, v_js)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'SPIELER_DOPPELT';
  end;
  return jsonb_build_object('id', v_id, 'ersetzt', v_ersetzt);
end;
$$;

-- Ändern (AK 2). Ein Name wirkt überall, auch an vergangenen Terminen.
create function spieler_aendern(p_spieler uuid, p_vorname text, p_nachname text, p_jahrgang int, p_js text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  begin
    update spieler set vorname = spieler_text_bereinigt(p_vorname), nachname = spieler_text_bereinigt(p_nachname),
                       jahrgang = p_jahrgang, js_nummer = nullif(btrim(coalesce(p_js, '')), '')
     where id = p_spieler;
  exception when unique_violation then
    raise exception 'SPIELER_DOPPELT';
  end;
end;
$$;

-- Entfernen (AK 3). Der Trigger hält vorher den Stand begonnener Termine fest.
create function spieler_entfernen(p_spieler uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  delete from spieler where id = p_spieler;
end;
$$;

revoke all on function spieler_aufnehmen(uuid, text, text, int, text) from public, anon;
revoke all on function spieler_aendern(uuid, text, text, int, text) from public, anon;
revoke all on function spieler_entfernen(uuid) from public, anon;
grant execute on function spieler_aufnehmen(uuid, text, text, int, text) to authenticated;
grant execute on function spieler_aendern(uuid, text, text, int, text) to authenticated;
grant execute on function spieler_entfernen(uuid) to authenticated;

reset lock_timeout;
