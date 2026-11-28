-- Teilnahme aller Spieler:innen eines Teams (#702): eine gemeinsame
-- Zählregel für die Einzel- und die Teamzählung, damit Übersicht,
-- Einzelteilnahme und KI-Assistent für dieselbe Spieler:in und denselben
-- Zeitraum dieselben Zahlen liefern (#702 NFR 3).
--
-- Forward-only: nur ein Index und Funktionen, keine Tabelle ändert sich.

-- Die Termine eines Teams in einem Zeitraum (bisher nur `(datum, beginn)`).
create index training_termine_team_datum_idx on training_termine (team_id, datum);

-- ── teilnahme_kern ──────────────────────────────────────────────────────────
-- Je begonnenem, nicht ausgefallenem Termin des Teams im Zeitraum (beide Tage
-- eingeschlossen, ein fehlender Tag lässt die Seite offen) und je
-- Spieler:in, die aktuell dem Team angehört (`team_spieler`, auch
-- Schnuppernde; wer das Team verlassen hat, erscheint nicht): das Ergebnis,
-- wo der Termin sie führt. Die Regel ist die von spieler_teilnahme (#700,
-- 20261127100000), mengenbasiert über Joins statt je Spieler:in:
-- - Festgehalten (`termin_eingefroren`): die Zeile der Spieler:in in
--   `termin_teilnahmen` bzw. `spiel_teilnahmen`; fehlt sie (bei Beginn nicht
--   auf der Liste, Kader galt nicht, ohne Liste begonnen), zählt der Termin
--   nicht. Da ist bei Trainings `abgemeldet = nachgetragen`
--   (spielstand_training, probe_stand), bei Spielen
--   `spiel_zaehlt(...) <> nachgetragen` (spiel_stand).
-- - Begonnen, aber noch nicht festgehalten (Festhalten geschieht erst beim
--   nächsten Schreiben im Team): der laufende Meldestand, nur wo der Termin
--   für die Spieler:in gilt. Nachträge gibt es dort keine — sie halten den
--   Termin fest. Ob der Termin gilt und ob sie abgemeldet ist, steht hier
--   als Zwilling von `termin_gilt_fuer` und `training_abgemeldet` in Joins:
--   Je Termin und Spieler:in aufgerufen, kosteten die Helfer (nicht
--   inline, SET search_path) für 100 Spieler:innen und ein Jahr rund 2 s
--   (#702 NFR 1). supabase/tests/team_teilnahme.sql prüft die Zwillinge
--   gegen die Helfer.
--
-- Die Gründe für «nicht da» (Rangfolge wie im Spielstand):
-- - Training: abgemeldet (auch: während des Schnupperns nicht angemeldet),
--   angemeldet und nicht erschienen.
-- - Spiel: nicht aufgeboten vor jeder Meldung (sie bleibt darunter
--   stehen), abgemeldet, angemeldet und nicht erschienen, ohne Meldung —
--   «meldefrist_verpasst», wo das Spiel eine Meldefrist hat (begonnen ist
--   sie immer abgelaufen, lib/spiel.ts meldefristVerpasst), sonst
--   «ohne_meldung» (PO 2026-11-27).
-- Zwilling der Ergebnis-Schlüssel: TEILNAHME_ERGEBNISSE in web/lib/teilnahme.ts.
--
-- Dazu, schon hier, damit die Zählregel nur einmal steht: die Meldung, die
-- der Termin für die Spieler:in festhält (Training: nur Abmeldungen, eine
-- Anmeldung zählt nie; Spiel: An- und Abmeldung aus dem Zustand, nicht aus
-- dem Ergebnis — sonst verdeckte «nicht aufgeboten» die Anmeldung), und wie
-- lange vor Beginn ihr letzter Wechsel lag. Die Zeit kommt bei Trainings aus
-- `termin_statuswechsel`, bei Spielen aus `spiel_teilnahmen` (festgehalten)
-- bzw. `spiel_meldungen` (offen). Streng vor Beginn (`<`): Wer nach einer
-- Vorverlegung erst ab dem neuen Beginn wechselte, hat keine Angabe; ohne
-- Beginn gibt es nie eine.
--
-- Intern, ohne API-Recht: Die Funktion liest unter den Rechten ihres
-- Aufrufers; aufgerufen wird sie nur aus den DEFINER-RPCs unten, die als
-- erste Anweisung die Mitgliedschaft prüfen.
create function teilnahme_kern(p_team uuid, p_von date, p_bis date, p_spieler uuid default null)
returns table (
  spieler_id uuid,
  termin_id uuid,
  art text,
  ergebnis text,
  meldung text,                          -- 'abmeldung' | 'anmeldung' | null
  sekunden_vor_beginn double precision   -- null: kein Zeitpunkt oder nicht vor Beginn
)
language sql stable
set search_path = public, pg_temp
as $$
  select ts.spieler_id, t.id, t.art, x.ergebnis, y.meldung,
         case when y.meldung is not null and y.zeit < b.beginn_tz
              then extract(epoch from b.beginn_tz - y.zeit)::double precision end
    from training_termine t
    join team_spieler ts on ts.team_id = t.team_id and (p_spieler is null or ts.spieler_id = p_spieler)
    left join termin_eingefroren f on f.termin_id = t.id
    left join termin_teilnahmen tp on f.termin_id is not null and t.art = 'training'
                                  and tp.termin_id = t.id and tp.spieler_id = ts.spieler_id
    left join spiel_teilnahmen sp on f.termin_id is not null and t.art = 'spiel'
                                 and sp.termin_id = t.id and sp.spieler_id = ts.spieler_id
    left join spiel_meldungen m on f.termin_id is null and t.art = 'spiel'
                               and m.termin_id = t.id and m.spieler_id = ts.spieler_id
    left join termin_statuswechsel w on t.art = 'training'
                                    and w.termin_id = t.id and w.spieler_id = ts.spieler_id
    left join termin_abmeldungen ab on f.termin_id is null and t.art = 'training'
                                   and ab.termin_id = t.id and ab.spieler_id = ts.spieler_id
                                   and ab.verfallen_am is null
    -- Zwilling von termin_gilt_fuer: Schnuppernde gilt kein Spiel; ein
    -- Termin mit Kader gilt nur deren Spieler:innen.
    cross join lateral (
      select case when f.termin_id is null then
               not (t.art = 'spiel' and ts.probe_seit is not null)
               and (not exists (select 1 from termin_kader tk
                                 where tk.termin_id = t.id and tk.kader_id is not null)
                    or exists (select 1 from termin_kader tk
                                 join kader_spieler ks on ks.kader_id = tk.kader_id
                                where tk.termin_id = t.id and ks.spieler_id = ts.spieler_id))
             end as gilt) g
    -- Zwilling von training_abgemeldet: die geltende Abmeldung, sonst der
    -- Grundstand (Schnuppernde sind ohne Anmeldung abgemeldet).
    cross join lateral (
      select case when f.termin_id is null and t.art = 'training' and g.gilt
                  then coalesce(not ab.angemeldet, not training_grundstand(ts.probe_seit)) end as ab_offen) a
    cross join lateral (
      select case
        when f.termin_id is not null then
          case when t.art = 'training' then
            case when tp.id is null then null
                 when tp.abgemeldet = tp.nachgetragen then 'da'
                 when tp.abgemeldet then 'abgemeldet'
                 else 'nicht_erschienen' end
          else
            case when sp.id is null then null
                 when spiel_zaehlt(sp.zustand, sp.nicht_aufgeboten) <> sp.nachgetragen then 'da'
                 when sp.nicht_aufgeboten then 'nicht_aufgeboten'
                 when sp.zustand = 'abgemeldet' then 'abgemeldet'
                 when sp.zustand = 'angemeldet' then 'nicht_erschienen'
                 when t.meldefrist_vorlauf_min is not null then 'meldefrist_verpasst'
                 else 'ohne_meldung' end
          end
        when g.gilt then
          case when t.art = 'training' then
            case when a.ab_offen then 'abgemeldet' else 'da' end
          else
            case when spiel_zaehlt(m.zustand, coalesce(m.nicht_aufgeboten, false)) then 'da'
                 when coalesce(m.nicht_aufgeboten, false) then 'nicht_aufgeboten'
                 when m.zustand = 'abgemeldet' then 'abgemeldet'
                 when t.meldefrist_vorlauf_min is not null then 'meldefrist_verpasst'
                 else 'ohne_meldung' end
          end
      end as ergebnis) x
    cross join lateral (
      select case
               when t.art = 'training' then
                 case when (case when f.termin_id is not null then tp.abgemeldet else a.ab_offen end) then 'abmeldung' end
               else
                 case (case when f.termin_id is not null then sp.zustand else m.zustand end)
                   when 'angemeldet' then 'anmeldung'
                   when 'abgemeldet' then 'abmeldung' end
             end as meldung,
             case when t.art = 'training' then w.gewechselt_am
                  when f.termin_id is not null then sp.gewechselt_am
                  else m.gewechselt_am end as zeit) y
    cross join lateral (
      select (t.datum + t.beginn) at time zone 'Europe/Zurich' as beginn_tz) b
   where t.team_id = p_team
     and not t.ausgefallen
     and termin_begonnen(t.datum, t.beginn)
     and (p_von is null or t.datum >= p_von)
     and (p_bis is null or t.datum <= p_bis)
     and x.ergebnis is not null;
$$;
revoke all on function teilnahme_kern(uuid, date, date, uuid) from public, anon, authenticated;

-- ── spieler_teilnahme ───────────────────────────────────────────────────────
-- Die Teilnahme einer Spieler:in (#700), jetzt aus teilnahme_kern; gleiche
-- Signatur und Rückgabe. SECURITY DEFINER statt INVOKER: Unter INVOKER
-- prüfte die RLS `ist_team_mitglied` je gelesener Zeile; hier steht die
-- Prüfung einmal als erste Anweisung. Ein Nicht-Mitglied bekommt darum
-- jetzt 42501 statt keiner Zeilen — über die Anwendung unerreichbar, der
-- Kern (lib/kern/teilnahme.ts) prüft vorher mit eigener Meldung.
create or replace function spieler_teilnahme(p_team uuid, p_spieler uuid, p_von date default null, p_bis date default null)
returns table (art text, ergebnis text, anzahl integer)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team' using errcode = '42501';
  end if;
  return query
    select k.art, k.ergebnis, count(*)::int
      from teilnahme_kern(p_team, p_von, p_bis, p_spieler) k
     group by k.art, k.ergebnis;
end
$$;
revoke all on function spieler_teilnahme(uuid, uuid, date, date) from public, anon;
grant execute on function spieler_teilnahme(uuid, uuid, date, date) to authenticated;

-- ── team_teilnahme ──────────────────────────────────────────────────────────
-- Die Teilnahme aller Spieler:innen eines Teams (#702): je Spieler:in mit
-- mindestens einem gezählten Termin eine Zeile mit den Zahlen je Art und
-- Ergebnis als jsonb (`[{art, ergebnis, anzahl}]`). Eine Zeile je
-- Spieler:in statt je Zahl: höchstens 100 Zeilen, weit unter `max_rows`
-- von PostgREST (config.toml), das sonst still abschnitte. Wer im Zeitraum
-- keinen gezählten Termin hat, fehlt; der Kern ergänzt Nullen.
-- Nur für Mitglieder des Teams (#702 NFR 2); auch die Vereinsverwaltung
-- sieht Team-Inhalte nur als Mitglied.
create function team_teilnahme(p_team uuid, p_von date default null, p_bis date default null)
returns table (spieler_id uuid, zeilen jsonb)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team' using errcode = '42501';
  end if;
  return query
    select g.sid, jsonb_agg(jsonb_build_object('art', g.art, 'ergebnis', g.ergebnis, 'anzahl', g.anzahl)
                            order by g.art, g.ergebnis)
      from (select k.spieler_id as sid, k.art, k.ergebnis, count(*)::int as anzahl
              from teilnahme_kern(p_team, p_von, p_bis) k
             group by k.spieler_id, k.art, k.ergebnis) g
     group by g.sid;
end
$$;
revoke all on function team_teilnahme(uuid, date, date) from public, anon;
grant execute on function team_teilnahme(uuid, date, date) to authenticated;
