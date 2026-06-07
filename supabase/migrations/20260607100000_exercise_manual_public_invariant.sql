-- Daten-Invariante: Manual-Übungen sind immer öffentlich.
-- Bisher nur operativ durch den Seed sichergestellt (alle Manual-Übungen public).
-- Die Sichtbarkeits-Logik (RLS ex_select, fav_insert) erreicht Manual-Übungen
-- ausschliesslich über visibility = 'public' (owner_id ist per manual_has_no_owner
-- stets NULL). Ohne diese Schranke wäre eine private Manual-Übung unsichtbar und
-- nicht favorisierbar — diese stille Falle schliesst der Constraint.

alter table exercises
  add constraint manual_is_public
  check (source <> 'manual' or visibility = 'public');
