-- ============================================================================
-- Nicht erschienene und doch erschienene Spieler:innen nachtragen (#475):
-- Ab Beginn eines Termins halten Mitglieder und der KI-Assistent fest, wer
-- trotz Anmeldung nicht erschienen und wer trotz Abmeldung doch erschienen
-- ist. An- und Abmelden bleibt bis zum Beginn (#435); der Stand bei Beginn
-- bleibt, was die Eltern in der Frist gemeldet haben (PO 1).
--
-- Ein Merkmal am festgehaltenen Stand: `termin_teilnahmen.nachgetragen` —
-- die Anwesenheit weicht vom Stand bei Beginn ab. Angemeldet + nachgetragen
-- heisst nicht erschienen, abgemeldet + nachgetragen doch erschienen (AK 1,
-- 2); so kann ein Nachtrag nur aus dem jeweils anderen Stand entstehen, und
-- die Herkunft bleibt erkennbar. Anwesend ist, wer angemeldet oder doch
-- erschienen ist (AK 9): `abgemeldet = nachgetragen`. Ohne Nachtrag gilt der
-- Stand bei Beginn (PO 2).
--
-- Wer einen Nachtrag setzt, nennt, ob die Spieler:in da war (`p_da`); daraus
-- folgt das Merkmal. Zurücknehmen heisst, den Stand bei Beginn wieder als
-- Anwesenheit zu setzen (AK 3) — dasselbe Setzen, ohne eigene Funktion.
--
-- Der Zeitpunkt des letzten Statuswechsels (#467) bleibt unberührt (PC 1).
-- Ehemalige Spieler:innen behalten ihre Zeile samt Merkmal (PC 5), lassen
-- sich aber nicht mehr ansprechen. Verlegt in die Zukunft, fällt der
-- festgehaltene Stand samt Nachträgen weg (PC 2, bestehender Trigger); in
-- eine andere begonnene Zeit bleibt er (PC 3).
--
-- Die Spielervertretung sieht davon nichts (AK 16): `spielstand` behält
-- `angemeldet` und `gesamt` am Stand bei Beginn und nennt die Anwesenden
-- zusätzlich, nur für Mitglieder ausgewertet.
--
-- Forward-only: eine Spalte mit Default an einer bestehenden Tabelle, neu
-- gefasste Funktionen; `termin_teilnehmer` fällt und entsteht neu.
-- ============================================================================
set lock_timeout = '5s';

alter table termin_teilnahmen add column nachgetragen boolean not null default false;

-- ── Nachtragen (AK 1–7) ─────────────────────────────────────────────────────

create function termin_anwesenheit_setzen(p_termin uuid, p_spieler uuid, p_da boolean,
                                          p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_stand jsonb;
  v_nachgetragen boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  -- Dieselbe Sperre wie Ab- und Anmelden und jede Änderung an Liste und
  -- Kadern, in derselben Reihenfolge: erst sie, dann die Zeile.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || t.team_id::text, 0));
  select * into t from training_termine where id = p_termin for update;
  if not found or not exists (select 1 from spieler where id = p_spieler and team_id = t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if not termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_begonnen', 'stand', v_stand);
  end if;
  -- Ein begonnener Termin ist womöglich noch nicht festgehalten (träge,
  -- siehe spielerliste): Seit Beginn hat sich nichts an ihm geändert, sein
  -- Stand jetzt ist der bei Beginn.
  perform termin_einfrieren(p_termin);
  update termin_teilnahmen set nachgetragen = (abgemeldet = p_da)
   where termin_id = p_termin and spieler_id = p_spieler
  returning nachgetragen into v_nachgetragen;
  -- AK 5: nur, wer im Stand bei Beginn steht — auch keiner, wenn das Team
  -- bei Beginn keine Liste führte.
  if not found then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_dabei', 'stand', v_stand);
  end if;
  return jsonb_build_object('status', 'ok', 'da', p_da, 'nachgetragen', v_nachgetragen,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function termin_anwesenheit_setzen(uuid, uuid, boolean, date, time) from public, anon;
grant execute on function termin_anwesenheit_setzen(uuid, uuid, boolean, date, time) to authenticated;

-- ── Lesen: die Anwesenden (AK 8–10, 13, 14) ─────────────────────────────────

-- Wie bisher, dazu `anwesend`: ab Beginn die Anwesenden, vorher null. Ein
-- begonnener, noch nicht festgehaltener Termin hat keine Nachträge — dort
-- sind die Angemeldeten anwesend. `spielstand` läuft mit den Rechten der
-- Lesenden; die Uhr-Regel dürfen sie darum aufrufen (wie `termin_gilt_fuer`).
grant execute on function termin_begonnen(date, time) to authenticated;

create or replace function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.n - z.ab, 'eingefroren', z.fest,
           'anwesend', case when z.fest then z.da
                            when termin_begonnen(t.datum, t.beginn) then z.n - z.ab end) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id)
                      when not e.mit_kader then (select count(*) from spieler s where s.team_id = t.team_id)
                      else (select count(distinct ks.spieler_id) from termin_kader tk
                              join kader_spieler ks on ks.kader_id = tk.kader_id
                             where tk.termin_id = t.id) end as n,
                 case when e.fest then (select count(*) from termin_teilnahmen p where p.termin_id = t.id and p.abgemeldet)
                      else (select count(*) from termin_abmeldungen a
                             where a.termin_id = t.id and a.verfallen_am is null
                               and termin_gilt_fuer(t.id, a.spieler_id)) end as ab,
                 case when e.fest then (select count(*) from termin_teilnahmen p
                                         where p.termin_id = t.id and p.abgemeldet = p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste,
                         exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id is not null) as mit_kader
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Wie bisher, dazu je Spieler:in, ob ihr Stand nachgetragen ist. Neue
-- Spalte: Die Funktion fällt und entsteht neu.
drop function termin_teilnehmer(uuid);
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean, kader text[],
               gewechselt_am timestamptz, nachgetragen boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.abgemeldet, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         w.gewechselt_am,
         x.nachgetragen
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest,
             p.nachgetragen
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname,
             exists (select 1 from termin_abmeldungen a
                      where a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null), false, false,
             false
        from training_termine t join spieler s on s.team_id = t.team_id
       where t.id = p_termin and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id;
$$;
revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;

-- ── Vor dem Verlegen: wie viele Nachträge verfallen (AK 12) ─────────────────

-- Ein einzelner Termin, verlegt auf `p_datum`/`p_beginn`: dieselbe
-- Entscheidung wie `termin_abmeldungen_verfallend`. Ehemalige zählen nicht —
-- wie bei den Abmeldungen.
create function termin_nachtraege_verfallend(p_termin uuid, p_datum date, p_beginn time)
returns integer
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin;
  if not found or not ist_team_mitglied(t.team_id)
     or (p_datum is not distinct from t.datum and p_beginn is not distinct from t.beginn)
     or termin_begonnen(p_datum, p_beginn) then
    return 0;
  end if;
  return (select count(*) from termin_teilnahmen p
           where p.termin_id = p_termin and p.nachgetragen and p.spieler_id is not null);
end;
$$;
revoke all on function termin_nachtraege_verfallend(uuid, date, time) from public, anon;
grant execute on function termin_nachtraege_verfallend(uuid, date, time) to authenticated;

-- Die Serie: wie bisher, dazu die Nachträge der Termine, die die Rechnung
-- wieder öffnet (verlegt auf einen noch bevorstehenden Zeitpunkt). Gezählt
-- wird vorher je Termin; danach zählen die, die es noch gibt und die nicht
-- mehr festgehalten sind. `p_verfallend` bestätigt die Summe aus allen dreien.
create or replace function terminserie_aendern(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer default null,
  p_entfallend uuid[] default null,
  p_ausfuehren boolean default true,
  p_verfallend integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb;
  v_team uuid;
  v_verlegt integer;
  v_kader integer;
  v_vorher jsonb;
  v_nachtraege integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  select coalesce(jsonb_object_agg(termin_id, n), '{}') into v_vorher
    from (select termin_id, count(*) as n from termin_teilnahmen
           where team_id = v_team and nachgetragen and spieler_id is not null group by termin_id) x;
  if p_ausfuehren then
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen(v_team);
    v_nachtraege := serie_nachtraege_verfallen(v_vorher);
    if p_verfallend is not null and p_verfallend <> v_verlegt + v_kader + v_nachtraege then
      raise exception 'SERIE_VERFALL_GEAENDERT';
    end if;
    return v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', v_kader,
                                   'nachtraege_verfallend', v_nachtraege);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v := v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', kader_bereinigen(v_team),
                                 'nachtraege_verfallend', serie_nachtraege_verfallen(v_vorher));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) to authenticated;

-- Wie viele der vorher gezählten Nachträge (Termin → Anzahl) an Terminen
-- hingen, die es noch gibt, die aber nicht mehr festgehalten sind.
create function serie_nachtraege_verfallen(p_vorher jsonb) returns integer
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(sum((p_vorher ->> k)::int), 0)::int
    from jsonb_object_keys(p_vorher) k
   where exists (select 1 from training_termine t where t.id = k::uuid)
     and not exists (select 1 from termin_eingefroren f where f.termin_id = k::uuid);
$$;
revoke all on function serie_nachtraege_verfallen(jsonb) from public, anon, authenticated;

reset lock_timeout;
