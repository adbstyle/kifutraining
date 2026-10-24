-- ============================================================================
-- Team-Auflösung gegen Versehen schützen (#480)
-- ============================================================================
-- Ein Team löst sich nur noch auf, wenn die auslösende Person den AKTUELLEN
-- Teamnamen bestätigt — beim ausdrücklichen Auflösen wie beim Austritt des
-- letzten Mitglieds (AK 5, 10, 11). Die Bestätigung prüft die Datenbank, nicht
-- die Oberfläche: sie gilt damit auch für Aufrufe ausserhalb der Oberfläche.
--
-- Darum fallen die direkten Wege weg, die ein Team bisher ohne jede Rückfrage
-- leeren konnten:
--   - DELETE auf `teams` (Policy teams_delete) — jedes Mitglied konnte das
--     Team per PostgREST löschen;
--   - DELETE auf `team_members` (Policy tm_delete) — der Austritt des letzten
--     Mitglieds löste über den Trigger team_aufloesen_wenn_leer auf.
-- Beides läuft nur noch über die zwei RPCs unten. Die Konto-Löschung bleibt
-- unberührt (Out of Scope 1): sie leert Teams über die auth.users-Kaskade, die
-- weder Grants noch Policies durchläuft.
--
-- Verglichen wird der Name genau, mit Gross- und Kleinschreibung (AK 6);
-- Leerzeichen am Anfang und Ende der Eingabe zählen nicht (AK 7). Der
-- gespeicherte Name trägt keine (teams_name_check, pruefeName). Beide Seiten
-- in Unicode-Normalform NFC: ein eingefügtes «ü» aus zwei Zeichen ist
-- dasselbe «ü».
--
-- Ob ein Austritt auflöst, entscheidet sich beim Ausführen (AK 12): Zählung,
-- Namensvergleich und Löschung liegen in derselben Transaktion unter einer
-- Zeilensperre auf dem Team.
--
-- Forward-only: Signaturwechsel von entferne_team_mitglied (boolean → text),
-- eine neue Funktion, entzogene Rechte. Keine Daten berührt.
-- ============================================================================
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1) Direkte Löschwege schliessen (AK 11)
-- ----------------------------------------------------------------------------
drop policy teams_delete on teams;
drop policy tm_delete on team_members;
revoke delete on teams from authenticated;
revoke delete on team_members from authenticated;

-- ----------------------------------------------------------------------------
-- 2) Bilder eines Teams, das gleich verschwindet
-- ----------------------------------------------------------------------------
-- Die Kaskade nimmt nur die Zeilen mit; die Dateien entfernt der Aufrufer
-- danach. Eingesammelt wird INNERHALB der Transaktion, die auch entscheidet,
-- ob wirklich aufgelöst wird.
create function team_bilder(p_team uuid) returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', te.id, 'bild_url', te.bild_url)), '[]'::jsonb)
    from training_exercises te
    join trainings t on t.id = te.training_id
   where t.team_id = p_team and te.bild_url is not null;
$$;
-- Nur für die beiden RPCs unten, die als Eigentümer laufen.
revoke all on function team_bilder(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) Mitglied entfernen bzw. austreten — mit Namen statt Ja/Nein
-- ----------------------------------------------------------------------------
-- Rückgaben (`status`):
--   entfernt           — die Person ist nicht (mehr) im Team, das Team lebt
--   aufgeloest         — letztes Mitglied ausgetreten, Team weg (+ `bilder`)
--   aufloesung_noetig  — wäre das letzte Mitglied, kein Name bestätigt (PC 4)
--   name_falsch        — bestätigter Name ≠ aktueller Name (PC 3, + `name`)
--   team_weg           — das Team besteht nicht mehr (PC 5)
-- `aufloesung_noetig` und `name_falsch` nennen den aktuellen Namen, damit die
-- Oberfläche ihn zur Eingabe zeigen kann (AK 4).
drop function entferne_team_mitglied(uuid, uuid, boolean);

create function entferne_team_mitglied(
  p_team uuid,
  p_user uuid,
  p_teamname text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_verbleibend int;
  v_bilder jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then
    -- Mit dem Team ist auch die Mitgliedschaft weg (PC 5).
    if not exists (select 1 from teams where id = p_team) then
      return jsonb_build_object('status', 'team_weg');
    end if;
    raise exception 'not a member of this team';
  end if;

  -- Sperren, damit ein gleichzeitiger Austritt oder eine Umbenennung die
  -- Zählung und den Namensvergleich nicht überholt — und unter der Sperre
  -- erneut prüfen, was sich bis dahin geändert haben kann.
  select name into v_name from teams where id = p_team for update;
  if not found then return jsonb_build_object('status', 'team_weg'); end if;
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team';
  end if;

  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = p_user) then
    -- Schon weg: kein Fehler, der Zielzustand ist erreicht.
    return jsonb_build_object('status', 'entfernt');
  end if;

  select count(*) - 1 into v_verbleibend
    from team_members where team_id = p_team;

  if v_verbleibend > 0 then
    delete from team_members where team_id = p_team and user_id = p_user;
    return jsonb_build_object('status', 'entfernt');
  end if;

  -- Der Vorgang leert das Team: nur mit dem aktuellen Namen.
  if p_teamname is null then
    return jsonb_build_object('status', 'aufloesung_noetig', 'name', v_name);
  end if;
  if normalize(btrim(p_teamname), nfc) is distinct from normalize(v_name, nfc) then
    return jsonb_build_object('status', 'name_falsch', 'name', v_name);
  end if;

  v_bilder := team_bilder(p_team);
  -- Der Trigger team_aufloesen_wenn_leer entfernt das Team samt Inhalten.
  delete from team_members where team_id = p_team and user_id = p_user;
  return jsonb_build_object('status', 'aufgeloest', 'bilder', v_bilder);
end;
$$;
revoke all on function entferne_team_mitglied(uuid, uuid, text) from public, anon;
grant execute on function entferne_team_mitglied(uuid, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Team ausdrücklich auflösen
-- ----------------------------------------------------------------------------
-- Jedes Mitglied darf auflösen (Precondition 1) — aber nur mit dem aktuellen
-- Namen. Rückgaben wie oben: aufgeloest (+ `bilder`), name_falsch (+ `name`),
-- team_weg.
create function loese_team_auf(p_team uuid, p_teamname text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_bilder jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then
    if not exists (select 1 from teams where id = p_team) then
      return jsonb_build_object('status', 'team_weg');
    end if;
    raise exception 'not a member of this team';
  end if;

  select name into v_name from teams where id = p_team for update;
  if not found then return jsonb_build_object('status', 'team_weg'); end if;
  if not ist_team_mitglied(p_team) then
    raise exception 'not a member of this team';
  end if;

  if p_teamname is null
     or normalize(btrim(p_teamname), nfc) is distinct from normalize(v_name, nfc) then
    return jsonb_build_object('status', 'name_falsch', 'name', v_name);
  end if;

  v_bilder := team_bilder(p_team);
  delete from teams where id = p_team;  -- kaskadiert alle Inhalte des Teams
  return jsonb_build_object('status', 'aufgeloest', 'bilder', v_bilder);
end;
$$;
revoke all on function loese_team_auf(uuid, text) from public, anon;
grant execute on function loese_team_auf(uuid, text) to authenticated;

reset lock_timeout;
