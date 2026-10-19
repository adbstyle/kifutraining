-- ============================================================================
-- Zeitpunkt des letzten Statuswechsels am Termin (#467): Mitglieder und der
-- KI-Assistent sehen je Spieler:in, seit wann ihr Status gilt.
--
-- Eine eigene Tabelle, weil «angemeldet» in `termin_abmeldungen` keine Zeile
-- hat (#435 AK 3) und eine Wieder-Anmeldung ihre Zeile löscht — samt Zeit.
-- `termin_statuswechsel` hält je Termin und Spieler:in nur den Zeitpunkt des
-- letzten echten Wechsels zwischen angemeldet und abgemeldet (AK 1, PC 1);
-- wer nie gewechselt hat, hat keine Zeile (AK 2). Erneutes Setzen desselben
-- Status ist kein Wechsel, die Zeit bleibt (PC 2).
--
-- Die Zeile lebt unabhängig vom Festhalten: Ab Beginn ändert sich nichts
-- mehr, die Zeit bleibt am Stand bei Beginn stehen (AK 11, PC 6). Wird eine
-- Spieler:in entfernt, geht ihre Zeit überall mit (PC 7, `on delete
-- cascade`) — die Zeile «Ehemalige Spieler:in» trägt keine.
--
-- Zurück auf «nie gewechselt»: eine Verlegung, nach der der Termin noch nicht
-- begonnen hat, für alle (PC 3), und ein Termin, der durch Kader nicht mehr
-- für eine Spieler:in gilt (PC 4). Ein Ausfall lässt die Zeiten ruhen (PC 5).
--
-- Bestand (PC 8): Offene Abmeldungen bringen ihren Zeitpunkt mit;
-- Wieder-Anmeldungen und festgehaltene Stände von früher haben keinen.
--
-- Forward-only: eine neue Tabelle (steht in PUBLIC_TABLES), neu gefasste
-- Funktionen; `termin_teilnehmer` fällt und entsteht neu (neue Spalte).
-- ============================================================================
set lock_timeout = '5s';

create table termin_statuswechsel (
  termin_id uuid not null references training_termine(id) on delete cascade,
  spieler_id uuid not null references spieler(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  gewechselt_am timestamptz not null default now(),
  primary key (termin_id, spieler_id)
);
create index termin_statuswechsel_spieler_idx on termin_statuswechsel (spieler_id);

alter table termin_statuswechsel enable row level security;
create policy tsw_select on termin_statuswechsel for select to authenticated using (ist_team_mitglied(team_id));
revoke all on termin_statuswechsel from anon, authenticated;
grant select on termin_statuswechsel to authenticated;

insert into termin_statuswechsel (termin_id, spieler_id, team_id, gewechselt_am)
  select termin_id, spieler_id, team_id, gesetzt_am from termin_abmeldungen where verfallen_am is null;

-- ── Ab- und Anmelden hält den Wechsel fest (PC 1, 2) ────────────────────────

create or replace function abmeldung_anwenden(p_termin uuid, p_spieler uuid, p_abgemeldet boolean,
                                              p_gesehen_datum date, p_gesehen_beginn time)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t training_termine;
  v_team uuid;
  v_stand jsonb;
  v_vorher boolean;
begin
  -- Dieselbe Sperre wie jede Änderung an Kadern (`kader_vorher`) und in
  -- derselben Reihenfolge — erst sie, dann die Zeile (siehe termin_kader).
  select team_id into v_team from training_termine where id = p_termin;
  if v_team is not null then
    perform pg_advisory_xact_lock(hashtextextended('spieler:' || v_team::text, 0));
  end if;
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
  if termin_begonnen(t.datum, t.beginn) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'begonnen', 'stand', v_stand);
  end if;
  if not termin_gilt_fuer(p_termin, p_spieler) then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'gilt_nicht', 'stand', v_stand);
  end if;
  -- Eine verfallene Abmeldung gilt nicht: Wer sie trägt, ist angemeldet.
  v_vorher := exists (select 1 from termin_abmeldungen
                       where termin_id = p_termin and spieler_id = p_spieler and verfallen_am is null);
  if p_abgemeldet then
    insert into termin_abmeldungen (termin_id, spieler_id, team_id) values (p_termin, p_spieler, t.team_id)
      on conflict (termin_id, spieler_id)
      do update set gesetzt_am = now(), verfallen_am = null, vorher_datum = null, vorher_beginn = null;
  else
    delete from termin_abmeldungen where termin_id = p_termin and spieler_id = p_spieler;
  end if;
  if v_vorher is distinct from p_abgemeldet then
    insert into termin_statuswechsel (termin_id, spieler_id, team_id) values (p_termin, p_spieler, t.team_id)
      on conflict (termin_id, spieler_id) do update set gewechselt_am = now();
  end if;
  return jsonb_build_object('status', 'ok', 'abgemeldet', p_abgemeldet,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function abmeldung_anwenden(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- ── Verlegen setzt alle zurück (PC 3) ───────────────────────────────────────

create or replace function termin_zeitpunkt_nachher() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if termin_begonnen(new.datum, new.beginn) then
    perform termin_einfrieren(new.id);
  elsif tg_op = 'UPDATE' then
    -- War er festgehalten (in die Zukunft verlegt): Seine Abmeldungen werden
    -- zu Markierungen, ehemalige Spieler:innen fallen weg.
    insert into termin_abmeldungen (termin_id, spieler_id, team_id, verfallen_am, vorher_datum, vorher_beginn)
      select new.id, p.spieler_id, new.team_id, now(), old.datum, old.beginn
        from termin_teilnahmen p
       where p.termin_id = new.id and p.abgemeldet and p.spieler_id is not null
      on conflict (termin_id, spieler_id) do nothing;
    delete from termin_eingefroren where termin_id = new.id;
    -- Eine schon verfallene behält den Zeitpunkt, für den sie abgegeben wurde.
    update termin_abmeldungen
       set verfallen_am = now(), vorher_datum = old.datum, vorher_beginn = old.beginn
     where termin_id = new.id and verfallen_am is null;
    -- Ein anderer Zeitpunkt ist wie ein neuer Termin: niemand hat gewechselt.
    delete from termin_statuswechsel where termin_id = new.id;
  end if;
  return null;
end;
$$;
revoke all on function termin_zeitpunkt_nachher() from public, anon, authenticated;

-- ── Kader-Wegfall setzt zurück (PC 4) ───────────────────────────────────────

-- Wie bisher, dazu die Wechsel derer, für die ein anstehender Termin nicht
-- mehr gilt: Gilt er wieder, haben sie dort nie gewechselt.
create or replace function kader_bereinigen(p_team uuid) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  delete from termin_statuswechsel w using training_termine t
   where w.termin_id = t.id and t.team_id = p_team
     and not termin_begonnen(t.datum, t.beginn)
     and not termin_gilt_fuer(t.id, w.spieler_id);
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
revoke all on function kader_bereinigen(uuid) from public, anon, authenticated;

-- ── Lesen: dazu der Zeitpunkt (AK 1, 11, 12) ────────────────────────────────

drop function termin_teilnehmer(uuid);
create function termin_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, abgemeldet boolean, ehemalig boolean, kader text[],
               gewechselt_am timestamptz)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.abgemeldet, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         w.gewechselt_am
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
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x
    left join termin_statuswechsel w on w.termin_id = p_termin and w.spieler_id = x.spieler_id;
$$;
revoke all on function termin_teilnehmer(uuid) from public, anon;
grant execute on function termin_teilnehmer(uuid) to authenticated;

reset lock_timeout;
