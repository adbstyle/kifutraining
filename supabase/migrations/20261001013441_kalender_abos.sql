-- ============================================================================
-- Team-Kalender (Epic #321), Story 9 (#330): persönliches Kalender-Abo je
-- Mitglied und Team. Der Link trägt ein Geheimnis; wer ihn hat, erhält Titel,
-- Zeit und Ort der Termine (Epic, bewusste Ausnahme), solange das Abo gilt.
-- ============================================================================
set lock_timeout = '5s';

create table kalender_abos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  -- Konto gelöscht → Abo weg (PC 9).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 244 zufällige Bit aus zwei v4-UUIDs (CSPRNG von Postgres), 64 Hex-Zeichen:
  -- nicht erratbar (AK 11). Im Klartext gespeichert, weil der Link im Konto
  -- jederzeit wieder einsehbar ist (AK 5); lesen darf ihn nur sein Konto.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)   -- AK 10: höchstens ein gültiger Link je Mitglied und Team
);

alter table kalender_abos enable row level security;
create policy ka_select on kalender_abos for select to authenticated using (user_id = auth.uid());
create policy ka_delete on kalender_abos for delete to authenticated using (user_id = auth.uid());
-- Die API-Rollen erhalten von Supabase per Default alle Rechte; erst alle
-- nehmen, dann nur Lesen und Löschen des eigenen Abos geben. Angelegt wird nur
-- über kalender_abo_holen, anon kommt an die Tabelle nie heran.
revoke all on kalender_abos from anon, authenticated;
grant select, delete on kalender_abos to authenticated;

-- Holen: derselbe Link, solange das Abo gilt (AK 6); nach dem Erlöschen ein
-- neuer (AK 9).
create function kalender_abo_holen(p_team uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not ist_team_mitglied(p_team) then raise exception 'TEAM_NICHT_GEFUNDEN'; end if;
  insert into kalender_abos (team_id, user_id) values (p_team, auth.uid())
    on conflict (team_id, user_id) do nothing;
  return (select token from kalender_abos where team_id = p_team and user_id = auth.uid());
end;
$$;
revoke all on function kalender_abo_holen(uuid) from public, anon;
grant execute on function kalender_abo_holen(uuid) to authenticated;

-- Der Feed (PC 1, 2, 5, 6, 9): anstehende Termine und die der 28 Tage vor
-- heute (Schweiz), ohne ausgefallene, nur Zeit und Ort. Aufrufbar ohne
-- Anmeldung — das Geheimnis IST die Berechtigung (AK 11).
create function kalender_abo_termine(p_token text) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  a kalender_abos;
  v_team teams;
begin
  select * into a from kalender_abos k
   where k.token = p_token
     and exists (select 1 from team_members m where m.team_id = k.team_id and m.user_id = k.user_id);
  if not found then return jsonb_build_object('gueltig', false); end if;
  select * into v_team from teams where id = a.team_id;
  return jsonb_build_object(
    'gueltig', true,
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name),
    'termine', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'datum', t.datum,
               'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
               'ort', t.ort, 'geaendert', t.updated_at)
             order by t.datum, t.beginn nulls last)
        from training_termine t
       where t.team_id = a.team_id and not t.ausgefallen
         and t.datum >= heute_am_trainingsort() - 28), '[]'::jsonb));
end;
$$;
revoke all on function kalender_abo_termine(text) from public;
grant execute on function kalender_abo_termine(text) to anon, authenticated;

-- Austritt, Entfernen, Auflösen, Konto löschen: Das Abo erlischt (PC 9) und
-- bleibt erloschen, auch bei erneuter Aufnahme (PC 10).
create function abo_erlischt() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from kalender_abos where team_id = old.team_id and user_id = old.user_id;
  return old;
end;
$$;
create trigger abo_erlischt after delete on team_members
  for each row execute function abo_erlischt();

reset lock_timeout;
