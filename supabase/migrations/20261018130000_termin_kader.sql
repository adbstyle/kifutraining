-- ============================================================================
-- Kader (Epic #447), Story 2 (#453): Termine und Serien für Kader festlegen.
--
-- Ein Termin mit Kadern gilt für die Spieler:innen, die mindestens einem
-- seiner Kader angehören, einer ohne Kader für alle (AK 4) — die eine Regel
-- `termin_gilt_fuer`. Nur sie zählen in der Spielerzahl (AK 7), nur sie
-- stehen am Termin (AK 6), nur sie lassen sich ab- und anmelden (AK 9).
--
-- Die Serie gibt Kader vor, ein Termin kann abweichen und wieder folgen —
-- wie die Verantwortlichen (#325): `termin_serien_kader`, `termin_kader`,
-- Flag `kader_abweichend`. Ein begonnener Termin ändert seine Kader nicht
-- mehr, auch nicht über die Serie (AK 13).
--
-- Verfall (PO 2026-10-18: spurlos): Gilt ein anstehender Termin für eine
-- Spieler:in nicht mehr, wird ihre Abmeldung gelöscht — auch während er
-- ausfällt (PC 1). Jede Änderung zählt in derselben Transaktion, wie viele
-- verfallen, und schreibt nur, wenn genau diese Zahl bestätigt ist (AK 10,
-- 12): sonst `ABMELDUNGEN_VERFALLEN n`. Die Serie meldet die Zahl in ihrer
-- Vorschau (`abmeldungen_kader`) und weist beim Ausführen ab, wenn sie sich
-- seither geändert hat (`p_verfallend`, SERIE_VERFALL_GEAENDERT).
--
-- Stand bei Beginn (PC 3, 4): Vor jeder Änderung an Zuteilungen hält
-- `kader_vorher` begonnene Termine fest (#452). Ein entfernter Kader bleibt
-- an begonnenen Terminen als Zeile ohne Kader stehen — der ehemalige Kader;
-- an anstehenden fällt er weg, und wer nur ihn trug, gilt danach für alle
-- (AK 11, PC 2). Dass ein festgehaltener Termin bei Beginn eine Spielerliste
-- hatte, merkt sich `termin_eingefroren.mit_liste`: Gilt er für niemanden,
-- steht dort 0 von 0, nicht «ohne Liste» (AK 7).
--
-- Forward-only: zwei neue Tabellen, eine Spalte mit Default am Termin, eine
-- mit Default und Backfill an `termin_eingefroren`. Signaturen mit neuen
-- Parametern fallen und entstehen neu (sonst wären zwei Überladungen über
-- PostgREST mehrdeutig). Neue Tabellen stehen in PUBLIC_TABLES.
-- ============================================================================
set lock_timeout = '5s';

-- ── Datenmodell ─────────────────────────────────────────────────────────────

-- Je Termin seine Kader. `kader_id` null: der Kader wurde entfernt, als der
-- Termin schon begonnen hatte — der ehemalige Kader (PC 4).
create table termin_kader (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references training_termine(id) on delete cascade,
  kader_id uuid references kader(id) on delete set null,
  team_id uuid not null references teams(id) on delete cascade,
  unique (termin_id, kader_id)
);
create index termin_kader_kader_idx on termin_kader (kader_id);

-- Die Kader, die eine Serie ihren Terminen vorgibt.
create table termin_serien_kader (
  serie_id uuid not null references termin_serien(id) on delete cascade,
  kader_id uuid not null references kader(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (serie_id, kader_id)
);
create index termin_serien_kader_kader_idx on termin_serien_kader (kader_id);

alter table termin_kader enable row level security;
alter table termin_serien_kader enable row level security;
create policy tk_select on termin_kader for select to authenticated using (ist_team_mitglied(team_id));
create policy tsk_select on termin_serien_kader for select to authenticated using (ist_team_mitglied(team_id));
revoke all on termin_kader from anon, authenticated;
revoke all on termin_serien_kader from anon, authenticated;
grant select on termin_kader to authenticated;
grant select on termin_serien_kader to authenticated;

-- Wie die übrigen Angaben (AK 3). Default: Bestandstermine folgen der Serie.
alter table training_termine add column kader_abweichend boolean not null default false;

-- Hatte das Team bei Beginn eine Spielerliste? Bestand: Wer festgehalten
-- wurde, ohne dass jemand teilnahm, hatte keine (so zählte `spielstand` bisher).
alter table termin_eingefroren add column mit_liste boolean not null default true;
update termin_eingefroren f set mit_liste = exists (select 1 from termin_teilnahmen p where p.termin_id = f.termin_id);

-- ── Die Regel ───────────────────────────────────────────────────────────────

-- Gilt der Termin für die Spieler:in (AK 4)? Ohne Kader für alle; zählen nur
-- Kader, die es noch gibt — ehemalige stehen nur an festgehaltenen Terminen.
-- Zwilling: giltFuer in web/lib/kader.ts.
create function termin_gilt_fuer(p_termin uuid, p_spieler uuid) returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from termin_kader tk where tk.termin_id = p_termin and tk.kader_id is not null)
      or exists (select 1 from termin_kader tk join kader_spieler ks on ks.kader_id = tk.kader_id
                  where tk.termin_id = p_termin and ks.spieler_id = p_spieler);
$$;
revoke all on function termin_gilt_fuer(uuid, uuid) from public, anon;
grant execute on function termin_gilt_fuer(uuid, uuid) to authenticated;

-- ── Festhalten: nur, für wen er gilt (PC 3) ─────────────────────────────────

create or replace function termin_einfrieren(p_termin uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is null or not exists (select 1 from spieler where team_id = v_team) then return; end if;
  insert into termin_eingefroren (termin_id, team_id, mit_liste) values (p_termin, v_team, true)
    on conflict (termin_id) do nothing;
  if not found then return; end if;
  insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
    select p_termin, v_team, s.id,
           exists (select 1 from termin_abmeldungen a
                    where a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null)
      from spieler s where s.team_id = v_team and termin_gilt_fuer(p_termin, s.id);
  delete from termin_abmeldungen where termin_id = p_termin;
end;
$$;

create or replace function termine_einfrieren(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  with neu as (
    insert into termin_eingefroren (termin_id, team_id, mit_liste)
      select t.id, t.team_id, exists (select 1 from spieler where team_id = p_team) from training_termine t
       where t.team_id = p_team
         and t.datum <= heute_am_trainingsort()
         and termin_begonnen(t.datum, t.beginn)
      on conflict (termin_id) do nothing
      returning termin_id),
  teilnahmen as (
    insert into termin_teilnahmen (termin_id, team_id, spieler_id, abgemeldet)
      select n.termin_id, p_team, s.id,
             exists (select 1 from termin_abmeldungen a
                      where a.termin_id = n.termin_id and a.spieler_id = s.id and a.verfallen_am is null)
        from neu n cross join spieler s where s.team_id = p_team and termin_gilt_fuer(n.termin_id, s.id)
      returning termin_id)
  delete from termin_abmeldungen a using neu n where a.termin_id = n.termin_id;
end;
$$;
revoke all on function termin_einfrieren(uuid) from public, anon, authenticated;
revoke all on function termine_einfrieren(uuid) from public, anon, authenticated;

-- ── Lesen: nur, für wen er gilt (AK 6, 7) ───────────────────────────────────

-- `null` nur, wenn das Team keine Spielerliste führt (bzw. bei Beginn keine
-- führte); gilt der Termin für niemanden, ist es 0 von 0 (AK 7).
create or replace function spielstand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object('gesamt', z.n, 'angemeldet', z.n - z.ab, 'eingefroren', z.fest) end
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
                               and termin_gilt_fuer(t.id, a.spieler_id)) end as ab
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste,
                         exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id is not null) as mit_kader
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Wer an einem Termin steht, dazu je Spieler:in die Kader, über die er für
-- sie gilt (AK 6, 15) — an einem festgehaltenen keine: Die Zuteilung von
-- damals ist nicht festgehalten, die heutige spräche falsch. Neue Spalte:
-- Die Funktion fällt und entsteht neu.
drop function termin_teilnehmer(uuid);
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean, kader text[])
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.abgemeldet, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end
    from (
      select p.spieler_id, s.vorname, s.nachname, p.abgemeldet, p.spieler_id is null as ehemalig, true as fest
        from termin_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname,
             exists (select 1 from termin_abmeldungen a
                      where a.termin_id = p_termin and a.spieler_id = s.id and a.verfallen_am is null), false, false
        from training_termine t join spieler s on s.team_id = t.team_id
       where t.id = p_termin and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x;
$$;
revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;

-- ── Ab- und Anmelden nur, für wen er gilt (AK 9) ────────────────────────────

create or replace function abmeldung_anwenden(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                              p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_stand jsonb;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not exists (select 1 from spieler where id = p_spieler and team_id = t.team_id) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  -- Dieselbe Sperre wie jede Änderung an Kadern (`kader_vorher`): Sonst
  -- bliebe eine Abmeldung stehen, die eine gleichzeitige Zuteilung eben
  -- hätte verfallen lassen.
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || t.team_id::text, 0));
  v_stand := jsonb_build_object('datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                'ende', to_char(t.ende, 'HH24:MI'), 'ausgefallen', t.ausgefallen);
  if (p_gesehen_datum is not null and p_gesehen_datum is distinct from t.datum)
     or (p_gesehen_beginn is not null and p_gesehen_beginn is distinct from t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'verlegt', 'stand', v_stand);
  end if;
  if t.ausgefallen then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'ausgefallen', 'stand', v_stand);
  end if;
  if termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'begonnen', 'stand', v_stand);
  end if;
  if not termin_gilt_fuer(p_termin, p_spieler) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht', 'stand', v_stand);
  end if;
  if p_abgemeldet then
    insert into termin_abmeldungen (termin_id, spieler_id, team_id) values (p_termin, p_spieler, t.team_id)
      on conflict (termin_id, spieler_id)
      do update set gesetzt_am = now(), verfallen_am = null, vorher_datum = null, vorher_beginn = null;
  else
    delete from termin_abmeldungen where termin_id = p_termin and spieler_id = p_spieler;
  end if;
  return jsonb_build_object('status', 'ok', 'abgemeldet', p_abgemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function abmeldung_anwenden(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- ── Verfall (PC 1; AK 10, 12) ───────────────────────────────────────────────

-- Die Abmeldungen anstehender Termine löschen, die nicht mehr gelten, und
-- zählen, wie viele davon galten (Markierungen einer Verlegung zählen nicht).
create function kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  with weg as (
    delete from termin_abmeldungen a using training_termine t
     where a.termin_id = t.id and t.team_id = p_team
       and not termin_begonnen(t.datum, t.beginn)
       and not termin_gilt_fuer(t.id, a.spieler_id)
    returning a.verfallen_am)
  select count(*) filter (where verfallen_am is null) into v from weg;
  return v;
end;
$$;

-- Der Haken nach jeder Änderung (#452): bereinigen und nur behalten, was
-- bestätigt ist — sonst alles zurück, mit der Zahl.
create or replace function kader_nachher(p_team uuid, p_bestaetigt integer) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer := kader_bereinigen(p_team);
begin
  if v > 0 and p_bestaetigt is distinct from v then
    raise exception 'ABMELDUNGEN_VERFALLEN %', v;
  end if;
  return v;
end;
$$;
revoke all on function kader_bereinigen(uuid) from public, anon, authenticated;
revoke all on function kader_nachher(uuid, integer) from public, anon, authenticated;

-- Einen Kader entfernen (#452 AK 3; PC 2, 4): An anstehenden Terminen fällt
-- er weg — wer nur ihn trug, gilt danach für alle —, an begonnenen bleibt er
-- als ehemaliger stehen (`on delete set null`). Serien verlieren ihn ebenso.
create or replace function kader_entfernen(p_kader uuid, p_bestaetigt integer default null) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  perform kader_vorher(v_team);
  delete from termin_kader tk using training_termine t
   where tk.termin_id = t.id and tk.kader_id = p_kader and not termin_begonnen(t.datum, t.beginn);
  delete from kader where id = p_kader;
  v_verfallen := kader_nachher(v_team, p_bestaetigt);
  return jsonb_build_object('team', v_team, 'verfallen', v_verfallen);
end;
$$;

-- Vor dem Entfernen (AK 11): welche anstehenden Termine und Serien danach
-- für alle gelten und wie viele Abmeldungen verfielen — die Rechnung läuft
-- und wird zurückgerollt.
create function kader_entfernen_folgen(p_kader uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  v := jsonb_build_object(
    'spieler', (select count(*) from kader_spieler where kader_id = p_kader),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'datum', t.datum, 'beginn', to_char(t.beginn, 'HH24:MI'),
                                          'ende', to_char(t.ende, 'HH24:MI'), 'serie', t.serie_id)
                       order by t.datum, t.beginn)
        from training_termine t
       where t.team_id = v_team and not termin_begonnen(t.datum, t.beginn)
         and exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id = p_kader)
         and not exists (select 1 from termin_kader tk where tk.termin_id = t.id
                          and tk.kader_id is not null and tk.kader_id <> p_kader)), '[]'::jsonb),
    'serien', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'wochentage', s.wochentage, 'beginn', to_char(s.beginn, 'HH24:MI'),
                                          'ende', to_char(s.ende, 'HH24:MI'), 'bis', s.end_datum)
                       order by s.beginn_datum)
        from termin_serien s
       where s.team_id = v_team
         and exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id = p_kader)
         and not exists (select 1 from termin_serien_kader sk where sk.serie_id = s.id and sk.kader_id <> p_kader)
         and exists (select 1 from training_termine t where t.serie_id = s.id
                      and not termin_begonnen(t.datum, t.beginn))), '[]'::jsonb));
  begin
    delete from termin_kader tk using training_termine t
     where tk.termin_id = t.id and tk.kader_id = p_kader and not termin_begonnen(t.datum, t.beginn);
    delete from kader where id = p_kader;
    v := v || jsonb_build_object('verfallend', kader_bereinigen(v_team));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function kader_entfernen_folgen(uuid) from public, anon;
grant execute on function kader_entfernen_folgen(uuid) to authenticated;

-- ── Kader eines einzelnen Termins (AK 1, 3, 13) ─────────────────────────────

-- Setzt die Kader eines anstehenden Termins; an einem Serientermin weicht er
-- damit ab, auch mit keinem Kader (Story-Entscheid: «keine Kader» heisst
-- «für alle»).
create function termin_kader_setzen(p_termin uuid, p_kader uuid[], p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_kader uuid[] := array(select distinct k from unnest(coalesce(p_kader, '{}')) k);
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = t.team_id)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;
  perform kader_vorher(t.team_id);
  delete from termin_kader where termin_id = p_termin;
  insert into termin_kader (termin_id, kader_id, team_id) select p_termin, k, t.team_id from unnest(v_kader) k;
  if t.serie_id is not null then
    update training_termine set kader_abweichend = true where id = p_termin;
  end if;
  v_verfallen := kader_nachher(t.team_id, p_bestaetigt);
  return jsonb_build_object('team', t.team_id, 'verfallen', v_verfallen);
end;
$$;
revoke all on function termin_kader_setzen(uuid, uuid[], integer) from public, anon;
grant execute on function termin_kader_setzen(uuid, uuid[], integer) to authenticated;

-- ── Serie festlegen mit Kadern (AK 2) ───────────────────────────────────────

drop function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], jsonb, smallint);
create function terminserie_festlegen(
  p_team uuid,
  p_wochentage smallint[],
  p_von date,
  p_bis date,
  p_beginn time,
  p_ende time,
  p_ort text,
  p_bemerkung text,
  p_verantwortliche uuid[] default '{}',
  p_felder jsonb default null,
  p_spielerzahl smallint default null,
  p_kader uuid[] default '{}')
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_serie termin_serien;
  v_anzahl integer;
  v_verantwortliche uuid[] := array(select distinct u from unnest(coalesce(p_verantwortliche, '{}')) u);
  v_kader uuid[] := array(select distinct k from unnest(coalesce(p_kader, '{}')) k);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if not wochentage_gueltig(p_wochentage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_von is null or p_bis is null then raise exception 'SERIE_OHNE_ZEITRAUM'; end if;
  if p_bis < p_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
  if p_bis > (p_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
  if not exists (select 1 from serien_tage(p_wochentage, p_von, p_bis)) then raise exception 'SERIE_OHNE_TAG'; end if;
  if p_beginn is null or p_ende is null or p_ende <= p_beginn then raise exception 'SERIE_ZEIT'; end if;
  if not alle_mitglieder(p_team, v_verantwortliche) then raise exception 'NICHT_MEHR_MITGLIED'; end if;
  if exists (select 1 from unnest(v_kader) k where not exists (select 1 from kader where id = k and team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                             felder, erwartete_spielerzahl)
  values (p_team,
          (select array_agg(w order by w) from unnest(p_wochentage) w),
          p_von, p_bis, p_beginn, p_ende,
          nullif(btrim(p_ort), ''), nullif(btrim(p_bemerkung), ''),
          nullif(p_felder, 'null'::jsonb), p_spielerzahl)
  returning * into v_serie;
  insert into termin_serien_verantwortliche (serie_id, user_id)
  select v_serie.id, u from unnest(v_verantwortliche) u;
  insert into termin_serien_kader (serie_id, kader_id, team_id)
  select v_serie.id, k, p_team from unnest(v_kader) k;

  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung,
                                  felder, erwartete_spielerzahl)
    select p_team, v_serie.id, d, d, v_serie.beginn, v_serie.ende, v_serie.ort, v_serie.bemerkung,
           v_serie.felder, v_serie.erwartete_spielerzahl
      from serien_tage(v_serie.wochentage, v_serie.beginn_datum, v_serie.end_datum) d
    returning id),
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, u from neu n cross join unnest(v_verantwortliche) u
    returning 1),
  eingeteilt as (
    insert into termin_kader (termin_id, kader_id, team_id)
    select n.id, k, p_team from neu n cross join unnest(v_kader) k
    returning 1)
  select count(*) into v_anzahl from neu;
  if v_anzahl = 0 then raise exception 'SERIE_OHNE_TAG'; end if;
  return jsonb_build_object('serie', v_serie.id, 'termine', v_anzahl);
end;
$$;
revoke all on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], jsonb, smallint, uuid[]) from public, anon;
grant execute on function terminserie_festlegen(uuid, smallint[], date, date, time, time, text, text, uuid[], jsonb, smallint, uuid[]) to authenticated;

-- ── Serie ändern mit Kadern (AK 2, 3, 13) ───────────────────────────────────
-- Vollständiger Rumpf aus terminserie_platz; neu ist der Schlüssel `kader`
-- (Liste von Kennungen) an allen vier Stellen. Anders als die übrigen Angaben
-- erreichen Kader nie einen begonnenen Termin (AK 13) — sie zählen darum auch
-- nicht zu den vergangenen.
create or replace function terminserie_rechnen(
  p_termin uuid,
  p_reichweite text,
  p_aenderung jsonb,
  p_version integer,
  p_entfallend uuid[])
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_heute date := heute_am_trainingsort();
  t training_termine;
  s termin_serien;
  x uuid;
  v_version_vorher integer;
  v_alt_tage smallint[];
  v_neu_tage smallint[];
  v_alt_von date;
  v_alt_bis date;
  v_neu_von date;
  v_neu_bis date;
  v_weg smallint[];
  v_dazu smallint[];
  v_tausch boolean;
  v_zeit boolean := p_aenderung ? 'beginn' or p_aenderung ? 'ende';
  v_beginn time;
  v_ende time;
  v_verantwortliche uuid[] := case when p_aenderung ? 'verantwortliche' then
    array(select distinct u::uuid from jsonb_array_elements_text(p_aenderung->'verantwortliche') u) end;
  v_mit_felder boolean := p_aenderung ? 'felder';
  v_felder jsonb := nullif(p_aenderung->'felder', 'null'::jsonb);
  v_mit_zahl boolean := p_aenderung ? 'spielerzahl';
  v_zahl smallint := (p_aenderung->>'spielerzahl')::smallint;
  -- #453: NULL heisst unverändert, eine (auch leere) Liste setzen.
  v_kader uuid[] := case when p_aenderung ? 'kader' then
    array(select distinct k::uuid from jsonb_array_elements_text(p_aenderung->'kader') k) end;
  v_entfallend uuid[] := '{}';
  v_vergangen uuid[] := '{}';
  v_belegt uuid[];
  v_liste jsonb;
  v_neu_vergangen uuid[];
  r record;
  v_ziel date;
begin
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if p_reichweite is null or p_reichweite not in ('dieser_und_folgende', 'alle') then
    raise exception 'REICHWEITE_UNGUELTIG';
  end if;
  select * into s from termin_serien where id = t.serie_id for update;
  v_version_vorher := s.version;
  if p_version is not null and s.version <> p_version then raise exception 'SERIE_GEAENDERT'; end if;
  perform 1 from training_termine where serie_id = s.id for update;

  v_alt_tage := s.wochentage;
  if p_reichweite = 'alle' then
    v_alt_von := s.beginn_datum; v_alt_bis := s.end_datum;
  else
    v_alt_von := t.datum; v_alt_bis := greatest(s.end_datum, t.datum);
  end if;

  if p_aenderung ? 'wochentage' then
    if jsonb_typeof(p_aenderung->'wochentage') <> 'array'
       or jsonb_array_length(p_aenderung->'wochentage') = 0 then
      raise exception 'SERIE_WOCHENTAGE';
    end if;
    v_neu_tage := (select array_agg(w::smallint order by w::smallint)
                     from jsonb_array_elements_text(p_aenderung->'wochentage') w);
  else
    v_neu_tage := v_alt_tage;
  end if;
  v_neu_von := coalesce((p_aenderung->>'beginn_datum')::date, v_alt_von);
  v_neu_bis := coalesce((p_aenderung->>'end_datum')::date, v_alt_bis);
  if p_reichweite = 'dieser_und_folgende' and v_neu_von < t.datum then
    raise exception 'TEILSERIE_BEGINN';
  end if;
  if not wochentage_gueltig(v_neu_tage) then raise exception 'SERIE_WOCHENTAGE'; end if;
  if p_aenderung ? 'wochentage' or p_aenderung ? 'beginn_datum' or p_aenderung ? 'end_datum' then
    if v_neu_bis < v_neu_von then raise exception 'SERIE_ENDE_VOR_BEGINN'; end if;
    if v_neu_bis > (v_neu_von + interval '1 year')::date then raise exception 'SERIE_ZU_LANG'; end if;
    if not exists (select 1 from serien_tage(v_neu_tage, v_neu_von, v_neu_bis)) then
      raise exception 'SERIE_OHNE_TAG';
    end if;
  end if;
  if v_zeit then
    v_beginn := (p_aenderung->>'beginn')::time;
    v_ende := (p_aenderung->>'ende')::time;
    if v_beginn is null or v_ende is null or v_ende <= v_beginn then raise exception 'SERIE_ZEIT'; end if;
  end if;
  if v_verantwortliche is not null and not alle_mitglieder(t.team_id, v_verantwortliche) then
    raise exception 'NICHT_MEHR_MITGLIED';
  end if;
  if v_kader is not null and exists (select 1 from unnest(v_kader) k
                                      where not exists (select 1 from kader where id = k and team_id = t.team_id)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;

  if p_reichweite = 'dieser_und_folgende' then
    insert into termin_serien (team_id, wochentage, beginn_datum, end_datum, beginn, ende, ort, bemerkung,
                               felder, erwartete_spielerzahl, version)
    values (s.team_id, v_neu_tage, v_neu_von, v_neu_bis,
            case when v_zeit then v_beginn else s.beginn end,
            case when v_zeit then v_ende else s.ende end,
            case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else s.ort end,
            case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else s.bemerkung end,
            case when v_mit_felder then v_felder else s.felder end,
            case when v_mit_zahl then v_zahl else s.erwartete_spielerzahl end,
            s.version + 1)
    returning id into x;
    insert into termin_serien_verantwortliche (serie_id, user_id)
    select x, u from unnest(coalesce(v_verantwortliche,
                     array(select sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id))) u;
    -- #453: Die Teilserie übernimmt die neuen Kader, sonst die der bisherigen.
    insert into termin_serien_kader (serie_id, kader_id, team_id)
    select x, k, s.team_id from unnest(coalesce(v_kader,
                     array(select sk.kader_id from termin_serien_kader sk where sk.serie_id = s.id))) k;
    update training_termine set serie_id = x where serie_id = s.id and datum >= t.datum;
    update termin_serien_luecken set serie_id = x where serie_id = s.id and tag >= t.datum;
    if exists (select 1 from training_termine where serie_id = s.id) then
      update termin_serien
         set end_datum = t.datum - 1, beginn_datum = least(beginn_datum, t.datum - 1)
       where id = s.id;
    else
      delete from termin_serien where id = s.id;
    end if;
  else
    x := s.id;
    update termin_serien set
      wochentage = v_neu_tage,
      beginn_datum = v_neu_von,
      end_datum = v_neu_bis,
      beginn = case when v_zeit then v_beginn else beginn end,
      ende = case when v_zeit then v_ende else ende end,
      ort = case when p_aenderung ? 'ort' then nullif(btrim(p_aenderung->>'ort'), '') else ort end,
      bemerkung = case when p_aenderung ? 'bemerkung' then nullif(btrim(p_aenderung->>'bemerkung'), '') else bemerkung end,
      felder = case when v_mit_felder then v_felder else felder end,
      erwartete_spielerzahl = case when v_mit_zahl then v_zahl else erwartete_spielerzahl end
    where id = x;
    if v_verantwortliche is not null then
      delete from termin_serien_verantwortliche where serie_id = x;
      insert into termin_serien_verantwortliche (serie_id, user_id) select x, u from unnest(v_verantwortliche) u;
    end if;
    if v_kader is not null then
      delete from termin_serien_kader where serie_id = x;
      insert into termin_serien_kader (serie_id, kader_id, team_id) select x, k, s.team_id from unnest(v_kader) k;
    end if;
  end if;

  -- 1) Wochentage.
  v_weg := array(select w from unnest(v_alt_tage) w where w <> all(v_neu_tage));
  v_dazu := array(select w from unnest(v_neu_tage) w where w <> all(v_alt_tage));
  v_tausch := cardinality(v_weg) = 1 and cardinality(v_dazu) = 1;
  if v_tausch then
    for r in select id, datum, serien_tag from training_termine
              where serie_id = x and extract(isodow from datum)::smallint = v_weg[1]
              order by datum, beginn nulls last, created_at loop
      v_ziel := r.datum + (v_dazu[1] - v_weg[1]);
      if v_ziel < v_neu_von or v_ziel > v_neu_bis
         or exists (select 1 from training_termine o
                     where o.serie_id = x and o.datum = v_ziel and o.id <> r.id)
         or (r.datum >= v_heute and v_ziel < v_heute) then
        v_entfallend := v_entfallend || r.id;
      else
        update training_termine
           set datum = v_ziel,
               serien_tag = case when serien_tag = r.datum then v_ziel else serien_tag end
         where id = r.id;
        if r.datum < v_heute or v_ziel < v_heute then v_vergangen := v_vergangen || r.id; end if;
      end if;
    end loop;
  elsif cardinality(v_weg) > 0 then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and extract(isodow from datum)::smallint = any(v_weg));
  end if;

  -- 2) Verkleinerter Zeitraum.
  if v_neu_von > v_alt_von or v_neu_bis < v_alt_bis then
    v_entfallend := v_entfallend || array(
      select id from training_termine
       where serie_id = x and (datum < v_neu_von or datum > v_neu_bis));
  end if;
  v_entfallend := array(select distinct e from unnest(v_entfallend) e);

  -- 3) Vorab-Auskunft prüfen.
  v_belegt := array(select id from training_termine
                     where id = any(v_entfallend) and training_id is not null order by id);
  if p_entfallend is not null
     and v_belegt is distinct from array(select e from unnest(p_entfallend) e order by e) then
    raise exception 'SERIE_BELEGUNG_GEAENDERT';
  end if;
  v_liste := coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', tt.id, 'datum', tt.datum, 'beginn', to_char(tt.beginn, 'HH24:MI'),
             'training', jsonb_build_object('id', tr.id, 'name', tr.name))
           order by tt.datum, tt.beginn nulls last)
      from training_termine tt join trainings tr on tr.id = tt.training_id
     where tt.id = any(v_entfallend)), '[]'::jsonb);

  -- 4) Löschen.
  v_vergangen := v_vergangen || array(
    select id from training_termine where id = any(v_entfallend) and datum < v_heute);
  delete from training_termine where id = any(v_entfallend);

  -- 5) Werte übernehmen.
  if v_zeit then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not zeit_abweichend or id = p_termin) and datum < v_heute
         and (beginn is distinct from v_beginn or ende is distinct from v_ende));
    update training_termine set beginn = v_beginn, ende = v_ende, zeit_abweichend = false
     where serie_id = x and (not zeit_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'ort' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not ort_abweichend or id = p_termin) and datum < v_heute
         and ort is distinct from nullif(btrim(p_aenderung->>'ort'), ''));
    update training_termine set ort = nullif(btrim(p_aenderung->>'ort'), ''), ort_abweichend = false
     where serie_id = x and (not ort_abweichend or id = p_termin);
  end if;
  if p_aenderung ? 'bemerkung' then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not bemerkung_abweichend or id = p_termin) and datum < v_heute
         and bemerkung is distinct from nullif(btrim(p_aenderung->>'bemerkung'), ''));
    update training_termine set bemerkung = nullif(btrim(p_aenderung->>'bemerkung'), ''), bemerkung_abweichend = false
     where serie_id = x and (not bemerkung_abweichend or id = p_termin);
  end if;
  if v_mit_felder then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not felder_abweichend or id = p_termin) and datum < v_heute
         and felder is distinct from v_felder);
    update training_termine set felder = v_felder, felder_abweichend = false
     where serie_id = x and (not felder_abweichend or id = p_termin);
  end if;
  if v_mit_zahl then
    v_vergangen := v_vergangen || array(
      select id from training_termine
       where serie_id = x and (not spielerzahl_abweichend or id = p_termin) and datum < v_heute
         and erwartete_spielerzahl is distinct from v_zahl);
    update training_termine set erwartete_spielerzahl = v_zahl, spielerzahl_abweichend = false
     where serie_id = x and (not spielerzahl_abweichend or id = p_termin);
  end if;
  if v_verantwortliche is not null then
    v_vergangen := v_vergangen || array(
      select tt.id from training_termine tt
       where tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin) and tt.datum < v_heute
         and array(select v.user_id from termin_verantwortliche v where v.termin_id = tt.id order by v.user_id nulls last)
             is distinct from array(select u from unnest(v_verantwortliche) u order by u));
    delete from termin_verantwortliche v using training_termine tt
     where v.termin_id = tt.id and tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    insert into termin_verantwortliche (termin_id, user_id)
    select tt.id, u from training_termine tt cross join unnest(v_verantwortliche) u
     where tt.serie_id = x and (not tt.verantwortliche_abweichend or tt.id = p_termin);
    update training_termine set verantwortliche_abweichend = false where id = p_termin;
  end if;
  -- #453: Kader in die anstehenden, die der Serie folgen, und den gewählten —
  -- nie in einen begonnenen (AK 13).
  if v_kader is not null then
    delete from termin_kader k using training_termine tt
     where k.termin_id = tt.id and tt.serie_id = x and (not tt.kader_abweichend or tt.id = p_termin)
       and not termin_begonnen(tt.datum, tt.beginn);
    insert into termin_kader (termin_id, kader_id, team_id)
    select tt.id, k, tt.team_id from training_termine tt cross join unnest(v_kader) k
     where tt.serie_id = x and (not tt.kader_abweichend or tt.id = p_termin)
       and not termin_begonnen(tt.datum, tt.beginn);
    update training_termine set kader_abweichend = false
     where id = p_termin and not termin_begonnen(datum, beginn);
  end if;

  -- 6) Hinzugekommene Tage, mit den Verantwortlichen und Kadern der Serie.
  with neu as (
    insert into training_termine (team_id, serie_id, serien_tag, datum, beginn, ende, ort, bemerkung,
                                  felder, erwartete_spielerzahl)
    select ts.team_id, x, d, d, ts.beginn, ts.ende, ts.ort, ts.bemerkung, ts.felder, ts.erwartete_spielerzahl
      from termin_serien ts, serien_tage(v_neu_tage, v_neu_von, v_neu_bis) d
     where ts.id = x
       and not exists (select 1 from serien_tage(case when v_tausch then v_neu_tage else v_alt_tage end,
                                                 v_alt_von, v_alt_bis) a where a = d)
       and not exists (select 1 from termin_serien_luecken l where l.serie_id = x and l.tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.serien_tag = d)
       and not exists (select 1 from training_termine o where o.serie_id = x and o.datum = d)
    returning id, datum, team_id),
  besetzt as (
    insert into termin_verantwortliche (termin_id, user_id)
    select n.id, sv.user_id from neu n join termin_serien_verantwortliche sv on sv.serie_id = x
    returning 1),
  eingeteilt as (
    insert into termin_kader (termin_id, kader_id, team_id)
    select n.id, sk.kader_id, n.team_id from neu n join termin_serien_kader sk on sk.serie_id = x
    returning 1)
  select coalesce(array_agg(id) filter (where datum < v_heute), '{}') into v_neu_vergangen from neu;
  v_vergangen := v_vergangen || v_neu_vergangen;

  if not exists (select 1 from training_termine where serie_id = x) then
    delete from termin_serien where id = x;
    x := null;
  end if;

  return jsonb_build_object(
    'serie', x,
    'version_vorher', v_version_vorher,
    'entfallend', v_liste,
    'entfallend_anzahl', cardinality(v_entfallend),
    'vergangene', (select count(distinct v) from unnest(v_vergangen) v));
end;
$$;
revoke all on function terminserie_rechnen(uuid, text, jsonb, integer, uuid[]) from public, anon, authenticated;

-- Die Hülle zählt nach der Rechnung beides, was verfiel: Abmeldungen einer
-- Verlegung (Markierungen, #437) und solche, deren Termin nicht mehr gilt
-- (#453). `p_verfallend`: die Summe, die die Oberfläche bestätigt hat —
-- stimmt sie nicht mehr, weist die Ausführung ab (AK 12).
drop function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean);
create function terminserie_aendern(
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
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from training_termine where id = p_termin;
  if p_ausfuehren then
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, p_entfallend);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v_kader := kader_bereinigen(v_team);
    if p_verfallend is not null and p_verfallend <> v_verlegt + v_kader then
      raise exception 'SERIE_VERFALL_GEAENDERT';
    end if;
    return v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', v_kader);
  end if;
  begin
    v := terminserie_rechnen(p_termin, p_reichweite, p_aenderung, p_version, null);
    select count(*) into v_verlegt from termin_abmeldungen where team_id = v_team and verfallen_am = now();
    v := v || jsonb_build_object('abmeldungen_verfallend', v_verlegt, 'abmeldungen_kader', kader_bereinigen(v_team));
    raise exception 'VORSCHAU_ZURUECK';
  exception when raise_exception then
    if sqlerrm = 'VORSCHAU_ZURUECK' then return v; end if;
    raise;
  end;
end;
$$;
revoke all on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) from public, anon;
grant execute on function terminserie_aendern(uuid, text, jsonb, integer, uuid[], boolean, integer) to authenticated;

-- ── Wieder der Serie folgen, auch die Kader (AK 3, 13) ──────────────────────

drop function termin_der_serie_folgen(uuid, text[]);
create function termin_der_serie_folgen(p_termin uuid, p_angaben text[], p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  s termin_serien;
  v_kader boolean;
  v_verfallen integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from training_termine where id = p_termin for update;
  if not found or not ist_team_mitglied(t.team_id) then raise exception 'TERMIN_NICHT_GEFUNDEN'; end if;
  if p_angaben is null or cardinality(p_angaben) = 0
     or not (p_angaben <@ array['zeit', 'ort', 'bemerkung', 'datum', 'verantwortliche', 'felder', 'spielerzahl', 'kader']) then
    raise exception 'SERIE_ANGABEN_UNGUELTIG';
  end if;
  if t.serie_id is null then raise exception 'TERMIN_OHNE_SERIE'; end if;
  if 'datum' = any(p_angaben) then raise exception 'DATUM_FOLGT_NICHT'; end if;
  v_kader := 'kader' = any(p_angaben);
  if v_kader and termin_begonnen(t.datum, t.beginn) then raise exception 'KADER_TERMIN_BEGONNEN'; end if;
  if v_kader then perform kader_vorher(t.team_id); end if;
  select * into s from termin_serien where id = t.serie_id;
  update training_termine set
    beginn = case when 'zeit' = any(p_angaben) then s.beginn else beginn end,
    ende = case when 'zeit' = any(p_angaben) then s.ende else ende end,
    zeit_abweichend = zeit_abweichend and not ('zeit' = any(p_angaben)),
    ort = case when 'ort' = any(p_angaben) then s.ort else ort end,
    ort_abweichend = ort_abweichend and not ('ort' = any(p_angaben)),
    bemerkung = case when 'bemerkung' = any(p_angaben) then s.bemerkung else bemerkung end,
    bemerkung_abweichend = bemerkung_abweichend and not ('bemerkung' = any(p_angaben)),
    verantwortliche_abweichend = verantwortliche_abweichend and not ('verantwortliche' = any(p_angaben)),
    felder = case when 'felder' = any(p_angaben) then s.felder else felder end,
    felder_abweichend = felder_abweichend and not ('felder' = any(p_angaben)),
    erwartete_spielerzahl = case when 'spielerzahl' = any(p_angaben) then s.erwartete_spielerzahl else erwartete_spielerzahl end,
    spielerzahl_abweichend = spielerzahl_abweichend and not ('spielerzahl' = any(p_angaben)),
    kader_abweichend = kader_abweichend and not v_kader
  where id = p_termin;
  if 'verantwortliche' = any(p_angaben) then
    delete from termin_verantwortliche where termin_id = t.id;
    insert into termin_verantwortliche (termin_id, user_id)
    select t.id, sv.user_id from termin_serien_verantwortliche sv where sv.serie_id = s.id;
  end if;
  if v_kader then
    delete from termin_kader where termin_id = t.id;
    insert into termin_kader (termin_id, kader_id, team_id)
    select t.id, sk.kader_id, t.team_id from termin_serien_kader sk where sk.serie_id = s.id;
    v_verfallen := kader_nachher(t.team_id, p_bestaetigt);
  end if;
  return jsonb_build_object('team', t.team_id, 'training', t.training_id, 'verfallen', v_verfallen);
end;
$$;
revoke all on function termin_der_serie_folgen(uuid, text[], integer) from public, anon;
grant execute on function termin_der_serie_folgen(uuid, text[], integer) to authenticated;

reset lock_timeout;
