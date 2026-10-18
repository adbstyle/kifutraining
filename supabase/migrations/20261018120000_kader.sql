-- ============================================================================
-- Kader (Epic #447), Story 1 (#452): Kader eines Teams führen und
-- Spieler:innen zuteilen.
--
-- Ein Kader ist ein vom Team benanntes Merkmal wie «Stärkeklasse 1» oder
-- «Torhüterinnen»; eine Spieler:in gehört keinem, einem oder mehreren an
-- (Epic PO 3). Der Name hat 1 bis 30 Zeichen und ist im Team eindeutig, wobei
-- Gross/Klein und überzählige Leerzeichen nicht unterscheiden (AK 10) — anders
-- als bei der Spielerliste unterscheiden Bindestrich und Apostroph sehr wohl.
-- Höchstens 20 Kader je Team (AK 11). Lesen darf jedes Mitglied, geschrieben
-- wird nur über die RPCs `kader_*` (AK 12).
--
-- Jede Änderung an Kadern und Zuteilungen läuft durch zwei Haken: Vorher hält
-- `kader_vorher` den Stand begonnener Termine fest — die Termine für Kader
-- (#453) lesen die Zuteilung —, nachher prüft `kader_nachher`, ob dadurch
-- Abmeldungen verfallen. Hier tut `kader_nachher` noch nichts; #453 ersetzt
-- ihn, ohne die Signaturen der RPCs zu ändern (`p_bestaetigt`).
--
-- Forward-only: nur neue Tabellen und Funktionen. Neue Tabellen stehen in
-- PUBLIC_TABLES (sync-staging.yml).
-- ============================================================================
set lock_timeout = '5s';

-- Die gespeicherte Form eines Kader-Namens ist die bereinigte
-- (`spieler_text_bereinigt`: NFC, ein Leerzeichen, aussen keins); der
-- Schlüssel der Eindeutigkeit nur zusätzlich klein. Zwilling: kaderSchluessel
-- in web/lib/kader.ts.
create function kader_schluessel(p text) returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select lower(spieler_text_bereinigt(p));
$$;
revoke all on function kader_schluessel(text) from public, anon, authenticated;

create table kader (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  -- Zwilling: KADER_NAME_MAX in web/lib/kader.ts; der Name ist der Marker.
  constraint kader_name check (name = spieler_text_bereinigt(name) and char_length(name) between 1 and 30),
  unique (id, team_id)
);
create unique index kader_eindeutig on kader (team_id, kader_schluessel(name));

comment on table kader is
  'Kader eines Teams (#452): ein benanntes Merkmal, dem Spieler:innen angehören. Geschrieben nur über die RPCs kader_*.';

-- Wer welchem Kader angehört. Beide Seiten im selben Team (zusammengesetzte
-- Schlüssel), beides fällt mit Kader, Spieler:in oder Team.
create table kader_spieler (
  kader_id uuid not null,
  spieler_id uuid not null references spieler(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (kader_id, spieler_id),
  foreign key (kader_id, team_id) references kader(id, team_id) on delete cascade
);
create index kader_spieler_spieler_idx on kader_spieler (spieler_id);
create index kader_spieler_team_idx on kader_spieler (team_id);

alter table kader enable row level security;
alter table kader_spieler enable row level security;
create policy kd_select on kader for select to authenticated using (ist_team_mitglied(team_id));
create policy ks_select on kader_spieler for select to authenticated using (ist_team_mitglied(team_id));
-- Die API-Rollen erhalten per Default alle Rechte; erst alle nehmen, dann nur
-- Lesen. Geschrieben wird ausschliesslich über die RPCs unten.
revoke all on kader from anon, authenticated;
revoke all on kader_spieler from anon, authenticated;
grant select on kader to authenticated;
grant select on kader_spieler to authenticated;

-- ── Die beiden Haken jeder Änderung ─────────────────────────────────────────

-- Vorher: die Sperre des Teams (dieselbe wie die Spielerliste — Zuteilung und
-- Liste ändern sich nie gleichzeitig) und den Stand begonnener Termine
-- festhalten.
create function kader_vorher(p_team uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || p_team::text, 0));
  perform termine_einfrieren(p_team);
end;
$$;

-- Nachher: wie viele Abmeldungen die Änderung verfallen liess. Ohne Kader an
-- Terminen (#453) gilt jeder Termin weiter für alle — nichts verfällt.
create function kader_nachher(p_team uuid, p_bestaetigt integer) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return 0;
end;
$$;
revoke all on function kader_vorher(uuid) from public, anon, authenticated;
revoke all on function kader_nachher(uuid, integer) from public, anon, authenticated;

-- Höchstens 20 Kader je Team (AK 11) — die Sperre schliesst das Wettrennen
-- zweier gleichzeitiger Anlagen aus.
create function kader_grenze() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('spieler:' || new.team_id::text, 0));
  if (select count(*) from kader where team_id = new.team_id) >= 20 then
    raise exception 'KADER_VOLL';
  end if;
  return new;
end;
$$;
create trigger kader_grenze before insert on kader
  for each row execute function kader_grenze();
revoke all on function kader_grenze() from public, anon, authenticated;

-- ── Schreiben ───────────────────────────────────────────────────────────────

-- Anlegen (AK 1, 10, 11).
create function kader_anlegen(p_team uuid, p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  begin
    insert into kader (team_id, name) values (p_team, spieler_text_bereinigt(p_name)) returning id into v_id;
  exception when unique_violation then
    raise exception 'KADER_DOPPELT';
  end;
  return v_id;
end;
$$;

-- Umbenennen (AK 2, 10, PC 2): Der Name steht nur hier, er wirkt überall.
create function kader_umbenennen(p_kader uuid, p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  begin
    update kader set name = spieler_text_bereinigt(p_name) where id = p_kader;
  exception when unique_violation then
    raise exception 'KADER_DOPPELT';
  end;
  return v_team;
end;
$$;

-- Entfernen (AK 3, PC 1): Alle Spieler:innen fallen aus dem Kader und bleiben
-- auf der Liste. `p_bestaetigt`: die Zahl verfallender Abmeldungen, die das
-- Mitglied bestätigt hat (#453).
create function kader_entfernen(p_kader uuid, p_bestaetigt integer default null) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from kader where id = p_kader;
  if v_team is null or not ist_team_mitglied(v_team) then raise exception 'KADER_NICHT_GEFUNDEN'; end if;
  perform kader_vorher(v_team);
  delete from kader where id = p_kader;
  v_verfallen := kader_nachher(v_team, p_bestaetigt);
  return jsonb_build_object('team', v_team, 'verfallen', v_verfallen);
end;
$$;

-- Zuteilen und herausnehmen in einem Schritt (AK 5, 6): Die Spieler:innen
-- `p_spieler` kommen in die Kader `p_dazu` und fallen aus `p_weg`. Alles
-- muss im Team liegen; wer schon dabei ist bzw. fehlt, bleibt, wie er ist.
create function kader_zuteilung_aendern(
  p_team uuid,
  p_spieler uuid[],
  p_dazu uuid[] default '{}',
  p_weg uuid[] default '{}',
  p_bestaetigt integer default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_dazu integer;
  v_weg integer;
  v_verfallen integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  if exists (select 1 from unnest(coalesce(p_spieler, '{}')) x
              where not exists (select 1 from spieler s where s.id = x and s.team_id = p_team)) then
    raise exception 'SPIELER_NICHT_GEFUNDEN';
  end if;
  if exists (select 1 from unnest(coalesce(p_dazu, '{}') || coalesce(p_weg, '{}')) x
              where not exists (select 1 from kader k where k.id = x and k.team_id = p_team)) then
    raise exception 'KADER_NICHT_GEFUNDEN';
  end if;
  perform kader_vorher(p_team);
  insert into kader_spieler (kader_id, spieler_id, team_id)
    select k, s, p_team from unnest(coalesce(p_dazu, '{}')) k cross join unnest(coalesce(p_spieler, '{}')) s
    on conflict do nothing;
  get diagnostics v_dazu = row_count;
  delete from kader_spieler
   where team_id = p_team and kader_id = any(coalesce(p_weg, '{}')) and spieler_id = any(coalesce(p_spieler, '{}'));
  get diagnostics v_weg = row_count;
  v_verfallen := kader_nachher(p_team, p_bestaetigt);
  return jsonb_build_object('dazu', v_dazu, 'weg', v_weg, 'verfallen', v_verfallen);
end;
$$;

revoke all on function kader_anlegen(uuid, text) from public, anon;
revoke all on function kader_umbenennen(uuid, text) from public, anon;
revoke all on function kader_entfernen(uuid, integer) from public, anon;
revoke all on function kader_zuteilung_aendern(uuid, uuid[], uuid[], uuid[], integer) from public, anon;
grant execute on function kader_anlegen(uuid, text) to authenticated;
grant execute on function kader_umbenennen(uuid, text) to authenticated;
grant execute on function kader_entfernen(uuid, integer) to authenticated;
grant execute on function kader_zuteilung_aendern(uuid, uuid[], uuid[], uuid[], integer) to authenticated;

reset lock_timeout;
