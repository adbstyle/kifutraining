-- ============================================================================
-- Nachtrag für Spiele (#487, Epic #448): Ab dem Anpfiff tragen Mitglieder
-- und der KI-Assistent nach, wer nicht erschienen und wer doch erschienen
-- ist — unbefristet, nur für wen im Stand beim Anpfiff steht, nicht an
-- einem ausgefallenen Spiel (AK 1–7).
--
-- Wie bei Trainings (#475) ein Merkmal am festgehaltenen Stand:
-- `spiel_teilnahmen.nachgetragen` — die Anwesenheit weicht vom Stand beim
-- Anpfiff ab. Gezählt hat beim Anpfiff, wer angemeldet und nicht als nicht
-- aufgeboten gekennzeichnet war (`spiel_zaehlt`); anwesend ist, wer zählte
-- und nicht nachgetragen ist, oder wer nicht zählte und nachgetragen ist
-- (AK 9). Meldung, Kennzeichnung und ihr Zeitpunkt bleiben (PC 1, 2).
--
-- Eine Verlegung öffnet ein begonnenes Spiel immer wieder (der Anpfiff
-- liegt danach in der Zukunft) — damit fallen die Nachträge mit dem Stand
-- beim Anpfiff weg (PC 3, bestehender Trigger); der Ausfall lässt sie ruhen
-- (PC 4). Die Spielervertretung sieht davon nichts (AK 19): `spiel_stand`
-- behält `angemeldet` am Stand beim Anpfiff und nennt `anwesend` dazu.
--
-- `termin_anwesenheit_setzen` verteilt nach der Art — derselbe Aufruf für
-- Oberfläche und KI.
--
-- Forward-only: eine Spalte mit Default an einer Tabelle aus demselben
-- Release, eine umbenannte und neue Funktionen.
-- ============================================================================
set lock_timeout = '5s';

alter table spiel_teilnahmen add column nachgetragen boolean not null default false;

-- Zählte die Spieler:in beim Anpfiff? Angemeldet und nicht als nicht
-- aufgeboten gekennzeichnet (#464 AK 7). Zwilling: `zaehlteBeimAnpfiff` in
-- web/lib/spiel.ts.
create function spiel_zaehlt(p_zustand text, p_nicht_aufgeboten boolean) returns boolean
language sql immutable
set search_path = public, pg_temp
as $$ select coalesce(p_zustand = 'angemeldet', false) and not p_nicht_aufgeboten; $$;
grant execute on function spiel_zaehlt(text, boolean) to authenticated;

-- ── Nachtragen (AK 1–7) ─────────────────────────────────────────────────────

create function spiel_anwesenheit_setzen(p_termin uuid, p_spieler uuid, p_da boolean,
                                         p_gesehen_datum date, p_gesehen_beginn time)
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
  if not found or t.art <> 'spiel' or not ist_team_mitglied(t.team_id) or p_da is null then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_gefunden');
  end if;
  -- Dieselbe Sperre wie Melden und jede Änderung an Liste und Kadern, in
  -- derselben Reihenfolge: erst sie, dann die Zeile.
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
  -- Ein begonnenes Spiel ist womöglich noch nicht festgehalten (träge): Seit
  -- dem Anpfiff hat sich nichts an ihm geändert, sein Stand jetzt ist der beim Anpfiff.
  perform spiel_einfrieren(p_termin);
  update spiel_teilnahmen set nachgetragen = (spiel_zaehlt(zustand, nicht_aufgeboten) <> p_da)
   where termin_id = p_termin and spieler_id = p_spieler
  returning nachgetragen into v_nachgetragen;
  -- AK 5: nur, wer im Stand beim Anpfiff steht (OoS 8: ohne Liste keiner).
  if not found then
    return jsonb_build_object('status', 'abgewiesen', 'grund', 'nicht_dabei', 'stand', v_stand);
  end if;
  return jsonb_build_object('status', 'ok', 'da', p_da, 'nachgetragen', v_nachgetragen,
                            'stand', (select spielstand(x) from training_termine x where x.id = p_termin));
end;
$$;
revoke all on function spiel_anwesenheit_setzen(uuid, uuid, boolean, date, time) from public, anon, authenticated;

alter function termin_anwesenheit_setzen(uuid, uuid, boolean, date, time) rename to termin_anwesenheit_setzen_training;
revoke all on function termin_anwesenheit_setzen_training(uuid, uuid, boolean, date, time) from public, anon, authenticated;

-- Der Verteiler: ein Spiel mit seinem eigenen Nachtrag.
create function termin_anwesenheit_setzen(p_termin uuid, p_spieler uuid, p_da boolean,
                                          p_gesehen_datum date default null, p_gesehen_beginn time default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from training_termine where id = p_termin and art = 'spiel') then
    return spiel_anwesenheit_setzen(p_termin, p_spieler, p_da, p_gesehen_datum, p_gesehen_beginn);
  end if;
  return termin_anwesenheit_setzen_training(p_termin, p_spieler, p_da, p_gesehen_datum, p_gesehen_beginn);
end;
$$;
revoke all on function termin_anwesenheit_setzen(uuid, uuid, boolean, date, time) from public, anon;
grant execute on function termin_anwesenheit_setzen(uuid, uuid, boolean, date, time) to authenticated;

-- ── Lesen: die Anwesenden (AK 8–12) ─────────────────────────────────────────

-- Wie in 20261021230000_spiel_aufgebot.sql, dazu `anwesend`: ab dem Anpfiff
-- die Anwesenden, vorher null. Ein begonnenes, noch nicht festgehaltenes
-- Spiel hat keine Nachträge — dort sind anwesend, die zählen.
create or replace function spiel_stand(t training_termine) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select case when z.liste then jsonb_build_object(
           'gesamt', z.n, 'angemeldet', z.an, 'abgemeldet', z.ab, 'ohne_meldung', z.n - z.an - z.ab - z.na,
           'nicht_aufgeboten', z.na, 'meldungen', z.gemeldet, 'eingefroren', z.fest,
           'anwesend', case when z.fest then z.da
                            when termin_begonnen(t.datum, t.beginn) then z.an end) end
    from (select e.fest,
                 case when e.fest then e.mit_liste
                      else exists (select 1 from spieler s where s.team_id = t.team_id) end as liste,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id)
                      when not e.mit_kader then (select count(*) from spieler s where s.team_id = t.team_id)
                      else (select count(distinct ks.spieler_id) from termin_kader tk
                              join kader_spieler ks on ks.kader_id = tk.kader_id
                             where tk.termin_id = t.id) end as n,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'angemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'angemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as an,
                 case when e.fest then (select count(*) from spiel_teilnahmen p
                                         where p.termin_id = t.id and p.zustand = 'abgemeldet' and not p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand = 'abgemeldet'
                               and not m.nicht_aufgeboten and termin_gilt_fuer(t.id, m.spieler_id)) end as ab,
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.nicht_aufgeboten)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.nicht_aufgeboten
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as na,
                 -- Alle Meldungen, auch die nicht Aufgebotener: was mit dem Spiel verschwände.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id and p.zustand is not null)
                      else (select count(*) from spiel_meldungen m where m.termin_id = t.id and m.zustand is not null
                               and termin_gilt_fuer(t.id, m.spieler_id)) end as gemeldet,
                 -- #487 AK 9: wer zählte und nicht als nicht erschienen nachgetragen
                 -- ist, dazu wer als doch erschienen nachgetragen ist.
                 case when e.fest then (select count(*) from spiel_teilnahmen p where p.termin_id = t.id
                                           and spiel_zaehlt(p.zustand, p.nicht_aufgeboten) <> p.nachgetragen) end as da
            from (select f.termin_id is not null as fest, coalesce(f.mit_liste, false) as mit_liste,
                         exists (select 1 from termin_kader tk where tk.termin_id = t.id and tk.kader_id is not null) as mit_kader
                    from (select 1) d left join termin_eingefroren f on f.termin_id = t.id) e) z;
$$;

-- Wie in 20261021230000_spiel_aufgebot.sql, dazu je Spieler:in, ob ihr Stand
-- beim Anpfiff nachgetragen ist (AK 8). Neue Spalte: neu angelegt.
drop function spiel_teilnehmer(uuid);
create function spiel_teilnehmer(p_termin uuid)
returns table (spieler_id uuid, vorname text, nachname text, zustand text, verfallen boolean, ehemalig boolean,
               kader text[], gewechselt_am timestamptz, nicht_aufgeboten boolean, aufgebot_verfallen boolean,
               nachgetragen boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select x.spieler_id, x.vorname, x.nachname, x.zustand, x.verfallen, x.ehemalig,
         case when x.fest then '{}'::text[] else
         coalesce(array(select k.name from termin_kader tk join kader k on k.id = tk.kader_id
                          join kader_spieler ks on ks.kader_id = k.id
                         where tk.termin_id = p_termin and ks.spieler_id = x.spieler_id
                         order by k.name), '{}') end,
         x.gewechselt_am, x.nicht_aufgeboten, x.aufgebot_verfallen, x.nachgetragen
    from (
      select p.spieler_id, s.vorname, s.nachname, p.zustand, false as verfallen, p.spieler_id is null as ehemalig,
             true as fest, p.gewechselt_am, p.nicht_aufgeboten, false as aufgebot_verfallen, p.nachgetragen
        from spiel_teilnahmen p left join spieler s on s.id = p.spieler_id
       where p.termin_id = p_termin
      union all
      select s.id, s.vorname, s.nachname, m.zustand, coalesce(m.verfallen, false), false, false, m.gewechselt_am,
             coalesce(m.nicht_aufgeboten, false), coalesce(m.aufgebot_verfallen, false), false
        from training_termine t join spieler s on s.team_id = t.team_id
        left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = s.id
       where t.id = p_termin and t.art = 'spiel' and termin_gilt_fuer(p_termin, s.id)
         and not exists (select 1 from termin_eingefroren f where f.termin_id = p_termin)) x;
$$;
revoke all on function spiel_teilnehmer(uuid) from public, anon;
grant execute on function spiel_teilnehmer(uuid) to authenticated;

reset lock_timeout;
