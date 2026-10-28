-- ============================================================================
-- KI-geführtes Feedback (Epic #541), Story 2 (#544): Spielervertretungen
-- melden über den privaten Link ihrer Spieler:in — ohne Konto.
--
-- Das Geheimnis im Link ist die Berechtigung (wie beim Ab- und Anmelden). Der
-- Link wird nie gespeichert (PC 3): Für das Tageslimit zählt ein Schlüssel aus
-- Link und Kalendertag, der sich nur am selben Tag wiedererkennen lässt
-- (PC 4) — beide Elternteile teilen sich so die fünf Dialoge (PO 18). Das
-- Feedback kennt nur das Team, nicht die Spieler:in (PC 1, 2).
-- ============================================================================

-- Der Zugangsschlüssel eines Links an einem Tag. Ohne den Link nicht zu
-- bilden und nach dem Tag zu nichts mehr nütze.
create function feedback_link_schluessel(p_token text, p_tag date) returns text
language sql immutable
as $$ select encode(sha256(convert_to('feedback:' || p_token || ':' || p_tag::text, 'UTF8')), 'hex') $$;
revoke all on function feedback_link_schluessel(text, date) from public, anon, authenticated;

-- Das Team hinter einem gültigen Link, sonst null. Erneuert, entfernt oder nie
-- vergeben sehen gleich aus (#436 AK 10, 11).
create function feedback_link_team(p_token text) returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$ select team_id from spieler where link_token = p_token and p_token ~ '^[0-9a-f]{64}$' $$;
revoke all on function feedback_link_team(text) from public, anon, authenticated;

-- Der Tag, an dem ein Dialog begann — für den Schlüssel, mit dem er zählt.
create function feedback_dialog_tag(p_dialog uuid) returns date
language sql stable security definer
set search_path = public, pg_temp
as $$ select tag from feedback_dialoge where id = p_dialog $$;
revoke all on function feedback_dialog_tag(uuid) from public, anon, authenticated;

create function feedback_link_beginnen(p_token text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if feedback_link_team(p_token) is null then return jsonb_build_object('status', 'ungueltig'); end if;
  return feedback_dialog_anlegen(feedback_link_schluessel(p_token, heute_am_trainingsort()));
end;
$$;

create function feedback_link_zaehlen(p_token text, p_dialog uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag date := feedback_dialog_tag(p_dialog);
begin
  if feedback_link_team(p_token) is null then return jsonb_build_object('status', 'ungueltig'); end if;
  if v_tag is null then return jsonb_build_object('status', 'unbekannt'); end if;
  return feedback_nachricht_zaehlen_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag));
end;
$$;

create function feedback_link_vermerken(p_token text, p_dialog uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag date := feedback_dialog_tag(p_dialog);
begin
  if v_tag is null or feedback_link_team(p_token) is null then return; end if;
  perform feedback_vorschlag_vermerken_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag));
end;
$$;

create function feedback_link_ablegen(
  p_token text, p_dialog uuid, p_einordnung feedback_einordnung, p_titel text, p_zusammenfassung jsonb,
  p_verlauf jsonb, p_seite text, p_version text, p_umgebung text, p_geraet text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid := feedback_link_team(p_token);
  v_tag  date := feedback_dialog_tag(p_dialog);
begin
  -- Wird der Link vor dem Bestätigen ungültig, speichert KiFu nichts (PC 5).
  if v_team is null then return jsonb_build_object('status', 'ungueltig'); end if;
  if v_tag is null then return jsonb_build_object('status', 'unbekannt'); end if;
  return feedback_ablegen_fuer(p_dialog, feedback_link_schluessel(p_token, v_tag), 'spielervertretung', null, v_team,
    p_einordnung, p_titel, p_zusammenfassung, p_verlauf, p_seite, p_version, p_umgebung, p_geraet);
end;
$$;

-- Ohne Konto: anon wie am übrigen privaten Link (spieler_link_abmelden).
revoke all on function feedback_link_beginnen(text) from public;
grant execute on function feedback_link_beginnen(text) to anon, authenticated;
revoke all on function feedback_link_zaehlen(text, uuid) from public;
grant execute on function feedback_link_zaehlen(text, uuid) to anon, authenticated;
revoke all on function feedback_link_vermerken(text, uuid) from public;
grant execute on function feedback_link_vermerken(text, uuid) to anon, authenticated;
revoke all on function feedback_link_ablegen(text, uuid, feedback_einordnung, text, jsonb, jsonb, text, text, text, text) from public;
grant execute on function feedback_link_ablegen(text, uuid, feedback_einordnung, text, jsonb, jsonb, text, text, text, text) to anon, authenticated;
