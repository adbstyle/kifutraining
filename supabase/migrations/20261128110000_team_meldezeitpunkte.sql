-- Meldezeitpunkte der Spieler:innen eines Teams (#703): wie lange vor
-- Beginn bzw. Anpfiff sie sich von Trainings abmelden und zu Spielen an-
-- und abmelden — je Spieler:in und Meldeart die Anzahl, der Median und die
-- Verteilung auf fünf Zeitfenster.
--
-- Forward-only: nur eine Funktion, keine Tabelle ändert sich.

-- ── team_meldezeitpunkte ────────────────────────────────────────────────────
-- Auf derselben Zählbasis wie die Teilnahme (#702, teilnahme_kern): begonnene,
-- nicht ausgefallene Termine im Zeitraum, für Spieler:innen, die aktuell im
-- Team sind, und nur, wo der Termin für sie zählt. Gezählt ist je Termin die
-- Meldung, die er festhält, mit dem Zeitpunkt ihres letzten Wechsels — wer
-- sie gesetzt hat, spielt keine Rolle (#703 OoS 1, 2):
-- - Training: nur Abmeldungen (angemeldet ist der Standard ohne Zeitpunkt);
--   der Zeitpunkt kommt aus `termin_statuswechsel`. Eine Verlegung löscht ihn.
-- - Spiel: An- und Abmeldungen getrennt, aus dem Zustand — auch wer danach
--   nicht aufgeboten wurde oder nicht erschien (PO 2026-11-28); der Zeitpunkt
--   aus `spiel_teilnahmen` (festgehalten) bzw. `spiel_meldungen` (offen). Eine
--   Verlegung auf einen anderen Tag löscht ihn, eine nur in der Uhrzeit misst
--   gegen den neuen Anpfiff.
-- Nur Meldungen streng vor Beginn (`sekunden_vor_beginn`, AK 6); ohne
-- Zeitpunkt (Grundstand, vor dem 19.10. bzw. 21.10.2026 gesetzt, verlegt)
-- gibt es keine Angabe.
--
-- Je (Spieler:in, Meldeart) eine Zeile — höchstens 3 je Spieler:in, also
-- weit unter `max_rows` von PostgREST (config.toml):
-- - `meldeart`: 'training_abmeldung' | 'spiel_anmeldung' | 'spiel_abmeldung'
--   (Zwilling: MELDEARTEN in web/lib/meldezeitpunkte.ts)
-- - `median_sekunden`: der Median (percentile_cont, bei gerader Anzahl das
--   Mittel der beiden mittleren)
-- - `fenster`: fünf Zähler — mehr als 7 Tage, mehr als 3 bis 7 Tage, mehr
--   als 24 Stunden bis 3 Tage, mehr als 6 bis 24 Stunden, höchstens 6
--   Stunden. Ein Grenzwert zählt ins Fenster, das dort endet (genau 3 Tage →
--   «mehr als 24 Stunden bis 3 Tage», PO 2026-11-28). Zwilling:
--   MELDE_FENSTER in web/lib/meldezeitpunkte.ts.
-- «Ohne Abmeldung gefehlt» und «nicht gemeldet» stehen nicht hier: Sie
-- kommen aus team_teilnahme, damit sie der Teilnahme-Übersicht gleichen
-- (#703 NFR 3).
--
-- Nur für Mitglieder des Teams (#703 NFR 2), geprüft als erste Anweisung;
-- auch die Vereinsverwaltung sieht Team-Inhalte nur als Mitglied.
create function team_meldezeitpunkte(p_team uuid, p_von date default null, p_bis date default null)
returns table (
  spieler_id uuid,
  meldeart text,
  anzahl integer,
  median_sekunden double precision,
  fenster integer[]
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team' using errcode = '42501';
  end if;
  return query
    select k.spieler_id,
           k.art || '_' || k.meldung,
           count(*)::int,
           percentile_cont(0.5) within group (order by k.sekunden_vor_beginn),
           array[
             count(*) filter (where k.sekunden_vor_beginn > 604800),
             count(*) filter (where k.sekunden_vor_beginn > 259200 and k.sekunden_vor_beginn <= 604800),
             count(*) filter (where k.sekunden_vor_beginn > 86400 and k.sekunden_vor_beginn <= 259200),
             count(*) filter (where k.sekunden_vor_beginn > 21600 and k.sekunden_vor_beginn <= 86400),
             count(*) filter (where k.sekunden_vor_beginn <= 21600)
           ]::int[]
      from teilnahme_kern(p_team, p_von, p_bis) k
     where k.meldung is not null
       and k.sekunden_vor_beginn is not null
     group by k.spieler_id, k.art, k.meldung;
end
$$;
revoke all on function team_meldezeitpunkte(uuid, date, date) from public, anon;
grant execute on function team_meldezeitpunkte(uuid, date, date) to authenticated;
