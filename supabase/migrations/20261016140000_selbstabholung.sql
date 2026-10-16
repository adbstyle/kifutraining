-- ============================================================================
-- Abmeldungen der Spieler:innen (Epic #433), Story 5 (#438): Eltern holen den
-- privaten Link ihrer Spieler:in selbst ab.
--
-- Die Abholadresse ist ein privater Link des Teams (244 Bit wie die übrigen);
-- wer sie hat und Vorname, Nachname und Jahrgang einer Spieler:in kennt,
-- erhält deren Link (PO 1). Sie gilt erst, wenn ein Mitglied die
-- Selbstabholung einschaltet (PC 1); aus und wieder ein gilt dieselbe (PC 5),
-- erneuert nie mehr die alte (PC 4). Bezogene Spieler-Links bleiben in jedem
-- Fall gültig (PC 6).
--
-- Abgeglichen wird wie bei der Eindeutigkeit im Team (`spieler_text_schluessel`,
-- PO 5). Eine nicht passende Eingabe antwortet immer gleich (AK 13); nach 5
-- davon innert 15 Minuten nimmt die Abholung 15 Minuten lang keine Eingabe
-- mehr vom selben Anschluss an (AK 15, PO 4) — auch keine passende. Den Anschluss kennt die Datenebene nur als
-- Schlüssel, den der Server aus der IP-Adresse mit einem geheimen Wert bildet —
-- keine Adresse in der Datenbank.
--
-- «bezogen» (PO 2) heisst nur: Der aktuelle Link einer Spieler:in wurde über
-- die Abholadresse herausgegeben (PC 2); Erneuern des Links setzt es zurück
-- (PC 3). Wer und wie oft, hält KiFu nicht fest (OoS 3).
-- ============================================================================
set lock_timeout = '5s';

-- ── Der Stand «bezogen» ─────────────────────────────────────────────────────

alter table spieler add column link_bezogen boolean not null default false;
grant select (link_bezogen) on spieler to authenticated;

create or replace function spieler_link_erneuern(p_spieler uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_token text := neues_geheimnis();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from spieler where id = p_spieler;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'SPIELER_NICHT_GEFUNDEN'; end if;
  update spieler set link_token = v_token, link_bezogen = false where id = p_spieler;
  return v_token;
end;
$$;

-- ── Die Abholadresse eines Teams ────────────────────────────────────────────

create table team_abholung (
  team_id uuid primary key references teams (id) on delete cascade,
  token text not null unique default neues_geheimnis(),
  aktiv boolean not null default false,
  created_at timestamptz not null default now()
);
alter table team_abholung enable row level security;
-- Mitglieder sehen die Adresse ihres Teams; geschrieben wird nur über die RPCs.
create policy tab_select on team_abholung for select to authenticated using (ist_team_mitglied(team_id));
revoke all on team_abholung from anon, authenticated;
grant select on team_abholung to authenticated;

-- Die Sperre nach 5 Fehlversuchen: je Anschluss (Schlüssel), für alle Teams.
create table abholung_sperren (
  schluessel text primary key,
  fehlversuche integer not null default 0,
  erster_fehler timestamptz not null default now(),
  gesperrt_bis timestamptz
);
alter table abholung_sperren enable row level security;
revoke all on abholung_sperren from anon, authenticated;

-- Lesen dürfen Mitglieder direkt (RLS); die Zeile entsteht beim ersten
-- Schalten oder Erneuern. Bis dahin ist die Selbstabholung aus (PO 3).
create function abholung_schalten(p_team uuid, p_aktiv boolean) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a team_abholung;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  insert into team_abholung (team_id, aktiv) values (p_team, p_aktiv)
    on conflict (team_id) do update set aktiv = excluded.aktiv
    returning * into a;
  return jsonb_build_object('token', a.token, 'aktiv', a.aktiv);
end;
$$;

create function abholung_erneuern(p_team uuid) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a team_abholung;
  v_token text := neues_geheimnis();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  insert into team_abholung (team_id, token) values (p_team, v_token)
    on conflict (team_id) do update set token = excluded.token
    returning * into a;
  return jsonb_build_object('token', a.token, 'aktiv', a.aktiv);
end;
$$;
revoke all on function abholung_schalten(uuid, boolean) from public, anon;
revoke all on function abholung_erneuern(uuid) from public, anon;
grant execute on function abholung_schalten(uuid, boolean) to authenticated;
grant execute on function abholung_erneuern(uuid) to authenticated;

-- ── Ohne Konto: die Abholseite (AK 6–18) ────────────────────────────────────

-- Ob die Adresse gilt, und der Teamname für den Kopf — sonst nichts (AK 18).
create function abholung_ansicht(p_token text) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object('gueltig', true, 'team', t.name)
       from team_abholung a join teams t on t.id = a.team_id
      where a.token = p_token and a.aktiv),
    jsonb_build_object('gueltig', false));
$$;

-- Abholen. Status: ungueltig | gesperrt | passt_nicht | ok (mit dem Link und
-- dem Namen, wie das Team ihn erfasst hat). `p_schluessel` bildet der Server
-- aus dem Anschluss; ohne ihn keine Abholung.
create function abholung_abholen(p_token text, p_schluessel text, p_vorname text, p_nachname text, p_jahrgang integer)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  sp abholung_sperren;
  s spieler;
begin
  select team_id into v_team from team_abholung where token = p_token and aktiv;
  if v_team is null then return jsonb_build_object('status', 'ungueltig'); end if;
  if p_schluessel is null or length(p_schluessel) < 32 then raise exception 'SCHLUESSEL_FEHLT'; end if;

  -- Abgelaufenes aufräumen, dann die Zeile dieses Anschlusses sperren.
  delete from abholung_sperren
   where coalesce(gesperrt_bis, erster_fehler + interval '15 minutes') < now() - interval '1 day';
  insert into abholung_sperren (schluessel) values (p_schluessel) on conflict (schluessel) do nothing;
  select * into sp from abholung_sperren where schluessel = p_schluessel for update;
  if sp.gesperrt_bis is not null and sp.gesperrt_bis > now() then
    return jsonb_build_object('status', 'gesperrt');
  end if;
  -- Die Zählung beginnt neu, wenn die Sperre oder die 15 Minuten seit dem
  -- ersten Fehlversuch vorbei sind.
  if sp.gesperrt_bis is not null or sp.erster_fehler < now() - interval '15 minutes' then
    update abholung_sperren set fehlversuche = 0, erster_fehler = now(), gesperrt_bis = null
     where schluessel = p_schluessel returning * into sp;
  end if;

  select * into s from spieler
   where team_id = v_team
     and spieler_text_schluessel(vorname) = spieler_text_schluessel(spieler_text_bereinigt(coalesce(p_vorname, '')))
     and spieler_text_schluessel(nachname) = spieler_text_schluessel(spieler_text_bereinigt(coalesce(p_nachname, '')))
     and jahrgang = p_jahrgang;
  if not found then
    update abholung_sperren
       set fehlversuche = fehlversuche + 1,
           erster_fehler = case when fehlversuche = 0 then now() else erster_fehler end,
           gesperrt_bis = case when fehlversuche + 1 >= 5 then now() + interval '15 minutes' end
     where schluessel = p_schluessel
     returning * into sp;
    return jsonb_build_object('status', case when sp.gesperrt_bis is not null then 'gesperrt' else 'passt_nicht' end);
  end if;

  -- Ein Treffer setzt die Fehlversuche NICHT zurück: Sonst rät, wer ein Kind
  -- kennt, zwischen zwei Treffern beliebig viele fremde Namen. Sie laufen nur
  -- mit den 15 Minuten aus.
  update spieler set link_bezogen = true where id = s.id;
  return jsonb_build_object('status', 'ok', 'token', s.link_token,
                            'spieler', jsonb_build_object('vorname', s.vorname, 'nachname', s.nachname));
end;
$$;
revoke all on function abholung_ansicht(text) from public;
revoke all on function abholung_abholen(text, text, text, text, integer) from public;
grant execute on function abholung_ansicht(text) to anon, authenticated;
grant execute on function abholung_abholen(text, text, text, text, integer) to anon, authenticated;

reset lock_timeout;
