"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Button, Dialog, KopierFeld, SectionMessage } from "@/components/ui";
import { BezogenLozenge } from "@/components/team/BezogenLozenge";
import { LINK_ERNEUERN_LADEFEHLER, LINK_TEXT, linkErneuernSaetze, linkTeamsText, type LinkTeam } from "@/lib/spieler";

/* Der private Link einer Spieler:in (#436 AK 1–3): holen, kopieren, erneuern.
   Der Link ist ein Geheimnis — was er kann, steht darum immer bei ihm (AK 2).
   Erneuern wirkt sofort: Der bisherige Link gilt nie wieder, die Abmeldungen
   bleiben (PC 2, 3). Ob der aktuelle Link über die Selbstabholung bezogen
   wurde, zeigt die Lozenge; Erneuern setzt ihn zurück (#438 PC 3).

   Der Link gehört der Spieler:in und zeigt die Termine aller ihrer Teams
   (#583): Der Hinweis nennt die Teams, und Erneuern fragt vorher nach — mit
   den Teams, die es trifft, und ob die Eltern den neuen Link über eine
   Abholadresse holen können. Die Teams liest der Dialog frisch über den
   Rückruf `teams`, beim Öffnen und noch einmal vor der Bestätigung. Wer
   abbricht, solange die Teams laden, bleibt draussen: Die späte Antwort
   öffnet die Bestätigung nicht wieder. Scheitert das Laden, schliesst sie
   mit einem Satz.

   Rein darstellend, mit Rückrufen: Holen und Erneuern sind Sache der
   Aufrufer — die Spielerliste eines Teams (Team-Actions) und der
   Spielerbestand des Vereins (Verein-Actions, Story #582). So hängt der
   Baustein an keiner Rolle (Rollen nach Ort, check:kern).

   Ergebnisse stehen IM Dialog, nicht in der Snackbar: Sie liegt unter dem
   modalen Dialog und wäre dort unsichtbar (wie beim Abo-Link). */

/** Was Holen liefert: die Adresse; `bezogen` und `hinweis` nur, wo die
 *  Datenebene sie mitgibt (Verein-Ort: der Hinweis für eine Spieler:in ohne
 *  Team, #582 AK 10). Ein Fehler mit `weg`: Die Spieler:in ist nicht mehr da
 *  (gelöscht); dann bleibt nur der Satz stehen, nicht der alte Link. */
type LinkFehler = { ok: false; error: string; weg?: boolean };
export type LinkHolen = { ok: true; url: string; bezogen?: boolean; hinweis?: string } | LinkFehler;
export type LinkErneuern = { ok: true; url: string } | LinkFehler;
export type LinkTeams = { ok: true; teams: LinkTeam[] } | LinkFehler;

export function LinkDialog({
  spieler,
  holen,
  erneuern,
  teams,
  ausgeschaltetHinweis = false,
  onClose,
}: {
  /** Wer gemeint ist; `null`: zu. `bezogen` gilt, bis Holen den Stand liefert. */
  spieler: { id: string; vorname: string; name: string; bezogen: boolean } | null;
  holen: (spielerId: string) => Promise<LinkHolen>;
  erneuern: (spielerId: string) => Promise<LinkErneuern>;
  /** Die Teams der Spieler:in, frisch gelesen, samt dem Stand ihrer Selbstabholung. */
  teams: (spielerId: string) => Promise<LinkTeams>;
  /** Der Dialog gehört einem Team: Der Hinweis sagt auch, dass dessen
   *  ausgeschaltete Selbstabholung den Link nicht sperrt (#583 AK 13). */
  ausgeschaltetHinweis?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={spieler !== null}
      onClose={onClose}
      title={spieler ? `Privater Link für ${spieler.name}` : ""}
      actions={
        <Button variant="outlined" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      {/* Eigene Komponente, damit Link und Zustand mit dem Schliessen verschwinden. */}
      {spieler && (
        <LinkInhalt
          key={spieler.id}
          spieler={spieler}
          holen={holen}
          erneuern={erneuern}
          teams={teams}
          ausgeschaltetHinweis={ausgeschaltetHinweis}
        />
      )}
    </Dialog>
  );
}

function LinkInhalt({
  spieler,
  holen,
  erneuern,
  teams,
  ausgeschaltetHinweis,
}: {
  spieler: { id: string; vorname: string; name: string; bezogen: boolean };
  holen: (spielerId: string) => Promise<LinkHolen>;
  erneuern: (spielerId: string) => Promise<LinkErneuern>;
  teams: (spielerId: string) => Promise<LinkTeams>;
  ausgeschaltetHinweis: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "error" | "success"; text: string } | null>(null);
  const [bezogen, setBezogen] = useState(spieler.bezogen);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [weg, setWeg] = useState(false);
  // Die Teams für den Hinweis; ein Fehler beim Lesen lässt ihn weg.
  const [teamListe, setTeamListe] = useState<LinkTeam[] | null>(null);
  // Die Bestätigung zum Erneuern: zu, lädt die Teams oder zeigt sie.
  const [frage, setFrage] = useState<"zu" | "laedt" | LinkTeam[]>("zu");
  // Zählt jedes Öffnen und Schliessen der Bestätigung: Eine Antwort gilt nur
  // für das Öffnen, das sie angefordert hat.
  const anfrage = useRef(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let aktiv = true;
    holen(spieler.id).then((r) => {
      if (!aktiv) return;
      if (!r.ok) {
        setWeg(!!r.weg);
        return setMeldung({ art: "error", text: r.error });
      }
      setUrl(r.url);
      if (r.bezogen !== undefined) setBezogen(r.bezogen);
      setHinweis(r.hinweis ?? null);
    });
    teams(spieler.id).then((r) => {
      if (aktiv && r.ok) setTeamListe(r.teams);
    });
    return () => {
      aktiv = false;
    };
    // Einmal je Spieler:in; die Rückrufe des Aufrufers wechseln mit jedem Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spieler.id]);

  // Vor dem Erneuern die Teams frisch lesen: Sie sind der Inhalt der Frage.
  function fragen() {
    const nr = ++anfrage.current;
    setFrage("laedt");
    teams(spieler.id).then(
      (r) => {
        if (nr !== anfrage.current) return;
        if (!r.ok) {
          setFrage("zu");
          setWeg(!!r.weg);
          return setMeldung({ art: "error", text: r.error });
        }
        setTeamListe(r.teams);
        setFrage(r.teams);
      },
      () => {
        if (nr !== anfrage.current) return;
        setFrage("zu");
        setMeldung({ art: "error", text: LINK_ERNEUERN_LADEFEHLER });
      },
    );
  }

  // Abbrechen (Knopf oder Escape) gilt, auch während die Teams noch laden.
  function abbrechen() {
    anfrage.current++;
    setFrage("zu");
  }

  function neu() {
    startTransition(async () => {
      const r = await erneuern(spieler.id);
      setFrage("zu");
      if (!r.ok) {
        setWeg(!!r.weg);
        return setMeldung({ art: "error", text: r.error });
      }
      setUrl(r.url);
      setBezogen(false);
      setMeldung({ art: "success", text: LINK_TEXT.erneuert });
    });
  }

  const teamsHinweis = teamListe && linkTeamsText(spieler.vorname, teamListe, ausgeschaltetHinweis);

  const oben: ReactNode = hinweis && <SectionMessage appearance="information">{hinweis}</SectionMessage>;

  // Die Spieler:in ist nicht mehr da: kein Link, kein Stand, nur der Satz.
  if (weg && meldung) return <SectionMessage appearance="error">{meldung.text}</SectionMessage>;

  return (
    <div className="flex flex-col gap-4">
      <BezogenLozenge bezogen={bezogen} className="self-start" />
      <p className="type-body-medium text-on-surface-mittel">
        Mit diesem Link meldet man {spieler.name} für Trainings ab und wieder an, ohne Konto. {LINK_TEXT.warnung}
      </p>
      {oben}
      {teamsHinweis && <SectionMessage appearance="information">{teamsHinweis}</SectionMessage>}
      {meldung && <SectionMessage appearance={meldung.art}>{meldung.text}</SectionMessage>}
      <KopierFeld label="Privater Link" value={url ?? "Wird geladen …"} disabled={!url} />
      <SectionMessage
        appearance="warning"
        actions={
          <Button variant="link" onClick={fragen} disabled={pending || !url || frage !== "zu"}>
            Link erneuern
          </Button>
        }
      >
        Weitergegeben oder missbraucht? {LINK_TEXT.erneuern}
      </SectionMessage>
      <Dialog
        open={frage !== "zu"}
        onClose={() => !pending && abbrechen()}
        title="Link erneuern?"
        actions={
          <>
            <Button variant="outlined" onClick={abbrechen} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={neu} disabled={pending || frage === "laedt" || frage === "zu"}>
              Erneuern
            </Button>
          </>
        }
      >
        {Array.isArray(frage) ? (
          <div className="flex flex-col gap-2">
            {linkErneuernSaetze(spieler.vorname, frage).map((satz) => (
              <p key={satz}>{satz}</p>
            ))}
          </div>
        ) : (
          <p>Wird geladen …</p>
        )}
      </Dialog>
    </div>
  );
}
