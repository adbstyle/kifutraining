-- Teilnahme-Statistik einer Spieler:in (#700): je Art (Training, Spiel) und
-- Ergebnis die Zahl der Termine eines Teams, an denen die Spieler:in da war
-- oder aus welchem Grund nicht.
--
-- Es zählen nur Termine des Teams, die begonnen haben und nicht ausgefallen
-- sind, im Zeitraum (beide Tage eingeschlossen, ein fehlender Tag lässt die
-- Seite offen) und nur, wo der Termin die Spieler:in führt (AK 7). Welche
-- das sind und wie «da» gilt, entscheidet derselbe Stand wie am Termin:
-- - Festgehalten (`termin_eingefroren`): die Zeile der Spieler:in in
--   `termin_teilnahmen` bzw. `spiel_teilnahmen`; fehlt sie (bei Beginn nicht
--   auf der Liste, Kader galt nicht, ohne Liste begonnen), zählt der Termin
--   nicht. Da ist bei Trainings `abgemeldet = nachgetragen`
--   (spielstand_training, probe_stand), bei Spielen
--   `spiel_zaehlt(...) <> nachgetragen` (spiel_stand).
-- - Begonnen, aber noch nicht festgehalten (Festhalten geschieht erst beim
--   nächsten Schreiben im Team): der laufende Meldestand, nur wenn die
--   Spieler:in dem Team angehört und der Termin für sie gilt. Nachträge gibt
--   es dort keine — sie halten den Termin fest.
--
-- Die Gründe für «nicht da» (Rangfolge wie im Spielstand):
-- - Training: abgemeldet (auch: während des Schnupperns nicht angemeldet,
--   AK 4), angemeldet und nicht erschienen.
-- - Spiel: nicht aufgeboten vor jeder Meldung (sie bleibt darunter
--   stehen), abgemeldet, angemeldet und nicht erschienen, ohne Meldung —
--   «meldefrist_verpasst», wo das Spiel eine Meldefrist hat (begonnen ist
--   sie immer abgelaufen, lib/spiel.ts meldefristVerpasst), sonst
--   «ohne_meldung» (PO 2026-11-27).
--
-- SECURITY INVOKER: Alles Gelesene steht unter RLS `ist_team_mitglied`
-- (wie team_probe_staende); ein Nicht-Mitglied bekommt keine Zeilen. Die
-- Rechte- und Zugehörigkeitsprüfung mit eigener Meldung macht der Kern
-- (lib/kern/teilnahme.ts). Zwilling der Ergebnis-Schlüssel:
-- TEILNAHME_ERGEBNISSE in web/lib/teilnahme.ts.
create function spieler_teilnahme(p_team uuid, p_spieler uuid, p_von date default null, p_bis date default null)
returns table (art text, ergebnis text, anzahl integer)
language sql stable
set search_path = public, pg_temp
as $$
  select t.art, x.ergebnis, count(*)::int
    from training_termine t
    cross join lateral (
      select case
        when exists (select 1 from termin_eingefroren f where f.termin_id = t.id) then
          case when t.art = 'training' then
            (select case when p.abgemeldet = p.nachgetragen then 'da'
                         when p.abgemeldet then 'abgemeldet'
                         else 'nicht_erschienen' end
               from termin_teilnahmen p
              where p.termin_id = t.id and p.spieler_id = p_spieler)
          else
            (select case when spiel_zaehlt(p.zustand, p.nicht_aufgeboten) <> p.nachgetragen then 'da'
                         when p.nicht_aufgeboten then 'nicht_aufgeboten'
                         when p.zustand = 'abgemeldet' then 'abgemeldet'
                         when p.zustand = 'angemeldet' then 'nicht_erschienen'
                         when t.meldefrist_vorlauf_min is not null then 'meldefrist_verpasst'
                         else 'ohne_meldung' end
               from spiel_teilnahmen p
              where p.termin_id = t.id and p.spieler_id = p_spieler)
          end
        when exists (select 1 from team_spieler ts where ts.team_id = t.team_id and ts.spieler_id = p_spieler)
             and termin_gilt_fuer(t.id, p_spieler) then
          case when t.art = 'training' then
            case when training_abgemeldet(t.id, p_spieler) then 'abgemeldet' else 'da' end
          else
            (select case when spiel_zaehlt(m.zustand, coalesce(m.nicht_aufgeboten, false)) then 'da'
                         when coalesce(m.nicht_aufgeboten, false) then 'nicht_aufgeboten'
                         when m.zustand = 'abgemeldet' then 'abgemeldet'
                         when t.meldefrist_vorlauf_min is not null then 'meldefrist_verpasst'
                         else 'ohne_meldung' end
               from (select 1) d
               left join spiel_meldungen m on m.termin_id = t.id and m.spieler_id = p_spieler)
          end
      end as ergebnis) x
   where t.team_id = p_team
     and not t.ausgefallen
     and termin_begonnen(t.datum, t.beginn)
     and (p_von is null or t.datum >= p_von)
     and (p_bis is null or t.datum <= p_bis)
     and x.ergebnis is not null
   group by t.art, x.ergebnis;
$$;
revoke all on function spieler_teilnahme(uuid, uuid, date, date) from public, anon;
grant execute on function spieler_teilnahme(uuid, uuid, date, date) to authenticated;
