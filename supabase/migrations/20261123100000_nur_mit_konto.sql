-- Übungen und Trainings nur mit Konto (Story #669, Epic #668).
--
-- Ohne Anmeldung ist keine Übung und kein Training mehr lesbar, auch nicht
-- die des Manuals (PO-Entscheid 1). «public» bleibt der Spaltenwert und heisst
-- an der Oberfläche «Community»: sichtbar für alle angemeldeten Konten
-- (PC 3) — die bisher öffentlichen, auch die anonymisierten gelöschter
-- Konten, bleiben es ohne Datenänderung.
--
-- Die Lese-Policies werden mit IDENTISCHEM `using` neu angelegt, nur statt
-- `to public` jetzt `to authenticated`. Schreib-Policies sind unberührt (sie
-- verlangen ohnehin `auth.uid()`). Forward-only: keine Datenänderung.
--
-- Einzige Ausnahme für Besucher:innen ohne Konto: die acht Beispiele der
-- Startseite über `startseite_beispiele()` (#670 AK 4).

-- ── Übungen ──────────────────────────────────────────────────────────────────
drop policy ex_select on public.exercises;
create policy ex_select on public.exercises
  for select to authenticated
  using ((visibility = 'public') or (owner_id = auth.uid()));

-- Favoriten gibt es ohnehin nur mit Konto; die Policy folgt der Regel, damit
-- keine Übungs-Tabelle mehr `to public` liest.
drop policy fav_select on public.exercise_favorites;
create policy fav_select on public.exercise_favorites
  for select to authenticated
  using (user_id = auth.uid());

-- ── Trainings und ihre Kind-Tabellen (Fassungen, Gruppen, Varianten) ─────────
drop policy tr_select on public.trainings;
create policy tr_select on public.trainings
  for select to authenticated
  using ((visibility = 'public') or (owner_id = auth.uid()) or ist_team_mitglied(team_id));

drop policy te_select on public.training_exercises;
create policy te_select on public.training_exercises
  for select to authenticated
  using (exists (
    select 1 from public.trainings p
    where p.id = training_exercises.training_id
      and ((p.visibility = 'public') or (p.owner_id = auth.uid()) or ist_team_mitglied(p.team_id))
  ));

drop policy tg_select on public.training_gruppen;
create policy tg_select on public.training_gruppen
  for select to authenticated
  using (exists (
    select 1 from public.trainings p
    where p.id = training_gruppen.training_id
      and ((p.visibility = 'public') or (p.owner_id = auth.uid()) or ist_team_mitglied(p.team_id))
  ));

drop policy teg_select on public.training_exercise_gruppen;
create policy teg_select on public.training_exercise_gruppen
  for select to authenticated
  using (exists (
    select 1 from public.training_exercises te
    join public.trainings p on p.id = te.training_id
    where te.id = training_exercise_gruppen.training_exercise_id
      and ((p.visibility = 'public') or (p.owner_id = auth.uid()) or ist_team_mitglied(p.team_id))
  ));

drop policy tv_select on public.training_varianten;
create policy tv_select on public.training_varianten
  for select to authenticated
  using (exists (
    select 1 from public.trainings p
    where p.id = training_varianten.training_id
      and ((p.visibility = 'public') or (p.owner_id = auth.uid()) or ist_team_mitglied(p.team_id))
  ));

-- ── Die Beispiele der Startseite ─────────────────────────────────────────────
-- Genau die Spalten, die die Übungskarte braucht (LIST_COLUMNS ohne
-- Favorit), für genau acht fest eingebaute Manual-Übungen mit Diagramm, in
-- der Reihenfolge der Anzeige. Zwilling: STARTSEITE_BEISPIELE in
-- web/lib/startseite.ts (Wächter in check:kern vergleicht beide Listen).
-- Keine Parameter: Wer die Funktion ruft, bekommt nie mehr als diese acht.
create function public.startseite_beispiele()
returns table (
  id uuid,
  slug text,
  name text,
  altersstufe text,
  trainingsteil text,
  feldtyp text,
  hauptteilkategorie text,
  kategorien text[],
  spielfeld_laenge_m integer,
  spielfeld_breite_m integer,
  anzahl_kinder jsonb,
  source text,
  visibility text,
  bild_url text,
  diagramm jsonb,
  bild_quelle text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.slug, e.name, e.altersstufe, e.trainingsteil, e.feldtyp,
         e.hauptteilkategorie, e.kategorien, e.spielfeld_laenge_m,
         e.spielfeld_breite_m, e.anzahl_kinder, e.source, e.visibility,
         e.bild_url, e.diagramm, e.bild_quelle
  from unnest(array[
    'freies-kleinfeldspiel',
    'fangis',
    'autorennen',
    'dribbler',
    'dribbling-1-1-frontal-auf-ein-tor',
    'passen-und-ballkontrolle-tigerball-durch-das-tor',
    'torabschluss-zielschuss',
    'penalty-koenig-in'
  ]) with ordinality as b(slug, pos)
  join public.exercises e on e.slug = b.slug
  where e.source = 'manual' and e.visibility = 'public'
  order by b.pos
$$;

revoke all on function public.startseite_beispiele() from public;
grant execute on function public.startseite_beispiele() to anon, authenticated;
