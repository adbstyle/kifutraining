-- «Verein voll» am Team-Ort (#706 AK 7): Ob der Spielerbestand des Vereins,
-- zu dem ein Team gehört, seine Grenze erreicht hat. Die Seiten eines Teams
-- sperren damit «Spieler:in hinzufügen» und sagen, warum.
--
-- Das Team erfährt nur Ja oder Nein, nie den Bestand: Trainer:innen lesen
-- den Spielerbestand des Vereins nicht (RLS). Darum SECURITY DEFINER, mit
-- der Prüfung `ist_team_mitglied` als erster Anweisung (Rollen nach Ort, AP
-- §5.5: am Team-Ort nur Trainer:in, keine Verwaltungsklausel; die
-- Verwaltung ohne Teamzugehörigkeit bekommt 42501). Der Name beginnt nicht
-- mit `verein_`: Es ist keine RPC des Bereichs «Verein».
--
-- Die Grenze 1000 ist dieselbe wie im Trigger `spieler_vorher` (Marker
-- VEREIN_VOLL); Zwilling in TS: VEREIN_SPIELER_MAX (web/lib/verein.ts).
-- Nur Auskunft: Keine Sperre, keine Schreibzeile — das Rennen deckt der
-- Trigger. Rein additiv, forward-only.

create function team_verein_voll(p_team uuid) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team' using errcode = '42501';
  end if;
  return (select count(*) >= 1000
            from spieler s
            join teams t on t.verein_id = s.verein_id
           where t.id = p_team);
end
$$;
revoke all on function team_verein_voll(uuid) from public, anon;
grant execute on function team_verein_voll(uuid) to authenticated;
