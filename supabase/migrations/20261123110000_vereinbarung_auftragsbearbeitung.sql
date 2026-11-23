-- Vereinbarung zur Auftragsbearbeitung (Story #675, Epic #668; ENTWURF, die
-- Rechtsberatung prüft den Text vor Produktion).
--
-- Wer einen Verein gründet, stimmt für den Verein der Vereinbarung zur
-- Auftragsbearbeitung zu (AK 2; Entscheid 1: sie ersetzt das bisherige zweite
-- Häkchen, «berechtigt» bleibt als `p_bestaetigt`). Die Datenebene hält fest,
-- welche Person wann welcher Fassung zugestimmt hat (PC 1), und löscht den
-- Nachweis mit dem Verein (PC 2, FK `on delete cascade`). Bestehende Vereine
-- haben keine Zeile (Out of Scope 1).
--
-- Die geltende Fassung steht an EINER Stelle je Seite:
-- `vereinbarung_fassung()` hier, Zwilling VEREINBARUNG_FASSUNG in
-- web/lib/rechtliches.ts (check:kern-db vergleicht beide). Gründen nimmt nur
-- die geltende Fassung an: Wer eine ältere Seite offen hatte, liest erst die
-- neue (VEREINBARUNG_VERALTET).
--
-- Die Verwaltung liest Zustimmung und geltende Fassung über
-- `verein_vereinbarung` (AK 3, 4), sonst niemand; die Tabelle selbst hat
-- kein API-Recht. Die Person nennt die Antwort nicht (Offene Frage 5).
--
-- Konto gelöscht, Verein bleibt (Offene Frage 2): `user_id` wird leer, Fassung
-- und Zeitpunkt bleiben.
--
-- Sperrordnung (AP §4.1) unverändert: Gründen sperrt Verein → Person; die
-- Zustimmung entsteht unter beiden Sperren nach der Verwaltungszeile.

set lock_timeout = '5s';

-- ── Tabelle ─────────────────────────────────────────────────────────────────

create table verein_zustimmungen (
  verein_id uuid not null references vereine (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  fassung text not null,
  zugestimmt_am timestamptz not null default now(),
  primary key (verein_id, fassung)
);
alter table verein_zustimmungen enable row level security;
-- Kein direkter Zugriff: geschrieben in verein_gruenden, gelesen in
-- verein_vereinbarung (beide SECURITY DEFINER).
revoke all on verein_zustimmungen from public, anon, authenticated;

-- ── Funktionen ──────────────────────────────────────────────────────────────

-- Die geltende Fassung der Vereinbarung. Zwilling: VEREINBARUNG_FASSUNG in
-- web/lib/rechtliches.ts.
create function vereinbarung_fassung() returns text
language sql immutable
set search_path = public, pg_temp
as $$ select '2026-11-entwurf'::text $$;

-- Rumpf wie in 20261115120000_verein_gruenden_loeschen.sql; neu ist
-- `p_fassung`: die Fassung der Vereinbarung, der die Person für den Verein
-- zustimmt (null = keine Zustimmung). `p_bestaetigt` ist nur noch «berechtigt,
-- für den Verein zu handeln»; sie wird wie bisher nicht festgehalten
-- (Offene Frage 2). Ohne Zustimmung oder mit einer anderen als der geltenden
-- Fassung entsteht kein Verein.
-- Die alte Signatur fällt ohne Übergang (kein Expand/Contract): ein Gründen
-- ohne Zustimmung soll es auch im Deploy-Fenster nicht geben. Folge: Ist die
-- Migration vor dem neuen Bundle auf Prod, scheitert «Verein gründen» kurz
-- mit der allgemeinen Meldung; im umgekehrten Fall fehlt auf der Übersicht
-- nur der Hinweis zur Vereinbarung (/verein wirft dafür nicht).
--   {status: 'gegruendet', id, name}
drop function verein_gruenden(text, boolean);
create function verein_gruenden(p_name text, p_bestaetigt boolean, p_fassung text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(namen_ohne_rand(p_name), '');   -- Rand wie im Vergleich (namen_stimmen)
begin
  perform nur_in_der_anwendung();
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_bestaetigt is not true then raise exception 'BESTAETIGUNG_FEHLT'; end if;
  if p_fassung is null then raise exception 'ZUSTIMMUNG_FEHLT'; end if;
  if p_fassung is distinct from vereinbarung_fassung() then raise exception 'VEREINBARUNG_VERALTET'; end if;
  perform sperre_verein(v_id);
  perform sperre_person(v_uid);
  if person_verein(v_uid) is not null then raise exception 'SCHON_IM_VEREIN'; end if;
  insert into vereine (id, name) values (v_id, v_name);
  insert into verein_verwaltung (verein_id, user_id) values (v_id, v_uid);
  insert into verein_zustimmungen (verein_id, user_id, fassung) values (v_id, v_uid, p_fassung);
  return jsonb_build_object('status', 'gegruendet', 'id', v_id, 'name', v_name);
end;
$$;

-- Die Vereinbarung des Vereins für seine Verwaltung (AK 3, 4): die geltende
-- Fassung und die jüngste Zustimmung des Vereins (null, wenn es keine gibt —
-- Vereine von vor #675). Wer nicht zur Verwaltung gehört, erfährt nur
-- VEREIN_NICHT_GEFUNDEN.
--   {geltend, zustimmung: {fassung, am} | null}
create function verein_vereinbarung(p_verein uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform nur_in_der_anwendung();
  if not ist_verein_verwaltung(p_verein) then raise exception 'VEREIN_NICHT_GEFUNDEN'; end if;
  return jsonb_build_object(
    'geltend', vereinbarung_fassung(),
    'zustimmung', (select jsonb_build_object('fassung', z.fassung, 'am', z.zugestimmt_am)
                     from verein_zustimmungen z
                    where z.verein_id = p_verein
                    order by z.zugestimmt_am desc, z.fassung desc
                    limit 1));
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function vereinbarung_fassung() from public, anon, authenticated;

revoke all on function verein_gruenden(text, boolean, text) from public, anon;
grant execute on function verein_gruenden(text, boolean, text) to authenticated;
revoke all on function verein_vereinbarung(uuid) from public, anon;
grant execute on function verein_vereinbarung(uuid) to authenticated;

reset lock_timeout;
