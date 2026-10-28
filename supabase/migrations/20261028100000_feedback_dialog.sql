-- ============================================================================
-- KI-geführtes Feedback (Epic #541), Story 1 (#542): Trainer:innen melden
-- einen Fehler, einen Wunsch oder eine Frage im Dialog mit der KI.
--
-- Gespeichert wird nur, was die Person bestätigt hat: die Zusammenfassung
-- samt Gesprächsverlauf (PO 5). Den Verlauf eines laufenden Dialogs hält
-- allein der Browser; die Datenbank kennt vom Dialog nur die Zähler für die
-- Limits (PO 13/15/29). Lesen kann ausschliesslich der Betreiber, direkt per
-- SQL (PO 2) — die Tabellen haben weder Policy noch Grant.
-- ============================================================================

-- Einordnung (PO 6): Ein fehlerhafter Inhalt gilt als Fehler. Die Person
-- sieht sie nicht; das Modell legt sie mit der Zusammenfassung fest.
create type feedback_einordnung as enum ('fehler', 'wunsch', 'frage');

-- ── Das Feedback ──────────────────────────────────────────────────────────
create table feedback (
  id              uuid primary key default gen_random_uuid(),
  eingegangen_am  timestamptz not null default now(),
  einordnung      feedback_einordnung not null,
  -- Trainer:in (Konto) oder Spielervertretung (privater Link, #544).
  rolle           text not null check (rolle in ('trainer', 'spielervertretung')),
  titel           text not null check (length(titel) between 1 and 200),
  -- [{bezeichnung, text}] — die Punkte der bestätigten Zusammenfassung.
  zusammenfassung jsonb not null check (jsonb_typeof(zusammenfassung) = 'array'),
  -- [{von: 'person'|'ki', text}] — das ganze Gespräch.
  verlauf         jsonb not null check (jsonb_typeof(verlauf) = 'array'),
  -- Kontext ohne Nachfrage (PO 4): die Seite beim Bestätigen (PO 30), die
  -- Version, die Umgebung, Gerät und Browser.
  seite           text not null check (length(seite) between 1 and 500),
  version         text not null check (length(version) between 1 and 40),
  umgebung        text not null check (length(umgebung) between 1 and 40),
  geraet          text not null check (length(geraet) <= 500),
  -- Die Konto-Löschung löst den Bezug, das Feedback bleibt (PO 9).
  user_id         uuid references auth.users(id) on delete set null,
  -- Nur bei Spielervertretungen (#544); eine Team-Auflösung löst ihn.
  team_id         uuid references teams(id) on delete set null
);
create index feedback_eingegangen_am_idx on feedback (eingegangen_am);
alter table feedback enable row level security;
-- Bewusst ohne Policy UND ohne Grant (Muster ki_aufrufe): Schreiben nur über
-- die definer-RPC unten, Lesen nur der Betreiber (PO 2).
revoke all on table feedback from anon, authenticated;

-- ── Die Dialoge eines Tages ───────────────────────────────────────────────
-- Zählt Dialoge je Zugang und Kalendertag (PO 15) und Nachrichten je Dialog
-- (PO 13). `schluessel` ist bei Trainer:innen die Konto-ID; `vorschlag_bei`
-- die Nachricht, mit der die erste Zusammenfassung kam — danach sind noch
-- zwei Nachrichten erlaubt. Zeilen vergangener Tage räumt der nächste
-- Dialogbeginn weg.
create table feedback_dialoge (
  id            uuid primary key default gen_random_uuid(),
  schluessel    text not null,
  tag           date not null,
  nachrichten   integer not null default 0 check (nachrichten >= 0),
  vorschlag_bei integer check (vorschlag_bei >= 1),
  gespeichert   boolean not null default false
);
create index feedback_dialoge_schluessel_tag_idx on feedback_dialoge (schluessel, tag);
alter table feedback_dialoge enable row level security;
revoke all on table feedback_dialoge from anon, authenticated;

-- ── Regeln (TS-Zwilling: web/lib/feedback/regeln.ts) ──────────────────────
-- Dialoge je Zugang und Tag (PO 15), Nachrichten bis zur Zusammenfassung und
-- danach (PO 13).
create function feedback_grenzen() returns jsonb
language sql immutable
as $$ select jsonb_build_object('dialoge_je_tag', 5, 'nachrichten', 10, 'korrekturen', 2) $$;
revoke all on function feedback_grenzen() from public, anon;

-- Beginnt einen Dialog für den Zugang `p_schluessel` — oder weist ihn ab,
-- wenn das Tageslimit erreicht ist. Gezählt wird der Kalendertag der ersten
-- Nachricht in Schweizer Zeit (PO 15/29). Nur für die RPCs unten.
create function feedback_dialog_anlegen(p_schluessel text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tag   date := heute_am_trainingsort();
  v_zahl  integer;
  v_id    uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback_dialoge:' || p_schluessel, 0));
  delete from feedback_dialoge where tag < v_tag;
  select count(*) into v_zahl from feedback_dialoge where schluessel = p_schluessel and tag = v_tag;
  if v_zahl >= (feedback_grenzen() ->> 'dialoge_je_tag')::int then
    return jsonb_build_object('status', 'tageslimit');
  end if;
  insert into feedback_dialoge (schluessel, tag) values (p_schluessel, v_tag) returning id into v_id;
  return jsonb_build_object('status', 'ok', 'dialog', v_id);
end;
$$;
revoke all on function feedback_dialog_anlegen(text) from public, anon, authenticated;

-- Zählt eine Nachricht im Dialog — oder weist sie ab, wenn das Limit erreicht
-- ist. Antwort: {status:'ok', nachricht, vorschlag_bei} | {status:'limit'} |
-- {status:'unbekannt'} (fremder, gespeicherter oder vergangener Dialog).
create function feedback_nachricht_zaehlen_fuer(p_dialog uuid, p_schluessel text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  d feedback_dialoge;
  g jsonb := feedback_grenzen();
begin
  select * into d from feedback_dialoge
   where id = p_dialog and schluessel = p_schluessel and not gespeichert
     and tag >= heute_am_trainingsort() - 1
   for update;
  if not found then return jsonb_build_object('status', 'unbekannt'); end if;
  if d.nachrichten >= (g ->> 'nachrichten')::int + (g ->> 'korrekturen')::int
     or (d.vorschlag_bei is not null and d.nachrichten >= d.vorschlag_bei + (g ->> 'korrekturen')::int) then
    return jsonb_build_object('status', 'limit');
  end if;
  update feedback_dialoge set nachrichten = nachrichten + 1 where id = d.id;
  return jsonb_build_object('status', 'ok', 'nachricht', d.nachrichten + 1, 'vorschlag_bei', d.vorschlag_bei);
end;
$$;
revoke all on function feedback_nachricht_zaehlen_fuer(uuid, text) from public, anon, authenticated;

-- Vermerkt, mit welcher Nachricht die erste Zusammenfassung kam.
create function feedback_vorschlag_vermerken_fuer(p_dialog uuid, p_schluessel text) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update feedback_dialoge set vorschlag_bei = nachrichten
   where id = p_dialog and schluessel = p_schluessel and vorschlag_bei is null and nachrichten >= 1;
$$;
revoke all on function feedback_vorschlag_vermerken_fuer(uuid, text) from public, anon, authenticated;

-- Speichert das bestätigte Feedback des Dialogs. Ein zweiter Aufruf für
-- denselben Dialog (erneuter Versuch nach einem Fehler) speichert nichts
-- doppelt und meldet trotzdem Erfolg.
create function feedback_ablegen_fuer(
  p_dialog uuid, p_schluessel text, p_rolle text, p_user uuid, p_team uuid,
  p_einordnung feedback_einordnung, p_titel text, p_zusammenfassung jsonb, p_verlauf jsonb,
  p_seite text, p_version text, p_umgebung text, p_geraet text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  d feedback_dialoge;
begin
  select * into d from feedback_dialoge
   where id = p_dialog and schluessel = p_schluessel and tag >= heute_am_trainingsort() - 1
   for update;
  if not found then return jsonb_build_object('status', 'unbekannt'); end if;
  if d.gespeichert then return jsonb_build_object('status', 'ok'); end if;
  if d.vorschlag_bei is null then return jsonb_build_object('status', 'ohne_vorschlag'); end if;
  insert into feedback (einordnung, rolle, titel, zusammenfassung, verlauf, seite, version, umgebung, geraet, user_id, team_id)
  values (p_einordnung, p_rolle, p_titel, p_zusammenfassung, p_verlauf, p_seite, p_version, p_umgebung, p_geraet, p_user, p_team);
  update feedback_dialoge set gespeichert = true where id = d.id;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function feedback_ablegen_fuer(uuid, text, text, uuid, uuid, feedback_einordnung, text, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;

-- ── Die Wege der Trainer:innen (angemeldet) ───────────────────────────────
-- Der Zugang ist das Konto; die interne Funktion bekommt es aus auth.uid(),
-- nie vom Aufrufer.
create function feedback_dialog_beginnen() returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return feedback_dialog_anlegen(auth.uid()::text);
end;
$$;
revoke all on function feedback_dialog_beginnen() from public, anon;
grant execute on function feedback_dialog_beginnen() to authenticated;

create function feedback_nachricht_zaehlen(p_dialog uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return feedback_nachricht_zaehlen_fuer(p_dialog, auth.uid()::text);
end;
$$;
revoke all on function feedback_nachricht_zaehlen(uuid) from public, anon;
grant execute on function feedback_nachricht_zaehlen(uuid) to authenticated;

create function feedback_vorschlag_vermerken(p_dialog uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform feedback_vorschlag_vermerken_fuer(p_dialog, auth.uid()::text);
end;
$$;
revoke all on function feedback_vorschlag_vermerken(uuid) from public, anon;
grant execute on function feedback_vorschlag_vermerken(uuid) to authenticated;

create function feedback_ablegen(
  p_dialog uuid, p_einordnung feedback_einordnung, p_titel text, p_zusammenfassung jsonb,
  p_verlauf jsonb, p_seite text, p_version text, p_umgebung text, p_geraet text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return feedback_ablegen_fuer(p_dialog, auth.uid()::text, 'trainer', auth.uid(), null,
    p_einordnung, p_titel, p_zusammenfassung, p_verlauf, p_seite, p_version, p_umgebung, p_geraet);
end;
$$;
revoke all on function feedback_ablegen(uuid, feedback_einordnung, text, jsonb, jsonb, text, text, text, text) from public, anon;
grant execute on function feedback_ablegen(uuid, feedback_einordnung, text, jsonb, jsonb, text, text, text, text) to authenticated;
