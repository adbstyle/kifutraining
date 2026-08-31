set lock_timeout = '5s';

-- ============================================================================
-- Story 5 (Epic Übungswelten): Die Altersstufe eines Trainings wird gewählt
-- ============================================================================
-- Der Default 'kinderfussball' war der Übergang aus Story 1: Solange der
-- Trainer die Altersstufe nicht selbst wählen konnte, musste ein neues Training
-- irgendwo zuhause sein. Mit Story 5 wählt er sie beim Anlegen — und sie steht
-- danach lebenslang fest (Trigger trainings_altersstufe_unveraenderlich).
--
-- Ohne Default muss die Applikation die Angabe explizit liefern; ein Insert,
-- der sie vergisst, scheitert an NOT NULL statt still ein Kinderfussball-
-- Training zu erzeugen. Genau das soll er: eine Wahl, die lebenslang bindet,
-- darf nicht durch eine Voreinstellung entstehen.
--
-- Auf `exercises` BLEIBT der Default: der Manual-Seed schreibt keine
-- Altersstufe, und das Manual Fussball Kinder ist per Definition
-- Kinderfussball.
alter table trainings alter column altersstufe drop default;

comment on column trainings.altersstufe is
  'Nach welchem Lehrmittel dieses Training geführt wird. Wird beim Anlegen gewählt (kein Default) und steht danach fest (Trigger trainings_altersstufe_unveraenderlich); wer für die andere Altersstufe plant, legt ein neues Training an (Story 1/5, Epic Übungswelten).';

reset lock_timeout;
