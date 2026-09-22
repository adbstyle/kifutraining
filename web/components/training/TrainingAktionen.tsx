"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Globe,
  Pencil,
  Play,
  Printer,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import {
  Button,
  Dialog,
  IconButtonLink,
  OverflowMenu,
  Snackbar,
  Tooltip,
  type MenuItemDef,
} from "@/components/ui";
import {
  SichtbarkeitDialoge,
  type SichtbarkeitSchritt,
} from "./SichtbarkeitDialoge";
import { TrainingZielDialog, type KopieZielWahl } from "./TrainingZielDialog";
import {
  hatUeberlauf,
  trainingAktionsRechte,
} from "@/lib/training-aktionen";
import {
  deleteTraining,
  setzeTrainingAufEntwurf,
  veroeffentlicheTraining,
} from "@/lib/actions/trainings";
import { stelleInsTeam, uebernimmTraining } from "@/lib/actions/team-trainings";
import type { Bearbeitungsziel } from "@/lib/training-zugriff";
import type { FehlendeBedingung } from "@/lib/training-bedingungen";
import type { TeamUebersicht } from "@/lib/queries/teams";
import { mitVariante, type Variante } from "@/lib/varianten";

/* Die Aktionen an einem Training — eine Reihe beschriftungsloser Zeichen mit
   Überlaufmenü am Ende, in derselben Bauform wie an der Übung (#249).

   EIN Bauteil für beide Orte. Nur so stehen die Zeichen beim Betrachten und
   beim Bearbeiten wirklich an derselben Stelle und in derselben Reihenfolge
   (AK 6/8) — zwei Aufrufer, die dieselbe Reihe je für sich zusammensetzen,
   laufen über kurz oder lang auseinander. `ort` unterscheidet das eine, was
   sich unterscheidet: Im Editor fehlt das Zeichen für Bearbeiten, denn dort
   bearbeitet man bereits (AK 9).

   Offen stehen die Alltagsaktionen Durchführen, Drucken, Bearbeiten. Alles
   Übrige liegt im ⋮ — nicht aus Platznot allein: Sieben offene Zeichen wären
   auf dem Telefon zu dicht, und Destruktives gehört ohnehin nie offen in eine
   Reihe (darum hat `IconButton` keine danger-Variante). Löschen steht als
   unterste Wahl und ist zweistufig: ⋮ → Eintrag → Bestätigung (AK 5/13).

   Keine Aktion ist hervorgehoben (AK 7) — auch Durchführen nicht, das bis
   hierher ein gefüllter Knopf war. Die Reihe trägt `print:hidden`: Auf dem
   Blatt hat kein Bedienelement etwas verloren (NFR 3).

   Was der Betrachter darf, rechnet `trainingAktionsRechte` aus. Hier steht
   keine Rechtebedingung mehr — die Server Actions und die RLS bleiben die
   Trust-Boundary, diese Reihe ist die Auskunft darüber. */
export function TrainingAktionen({
  ort,
  trainingId,
  name,
  visibility,
  teamId,
  angemeldet,
  bearbeitungsziel,
  teams,
  fehlendeBedingungen,
  varianten,
  aktiveVarianteId,
  melde,
}: {
  ort: "ansicht" | "editor";
  trainingId: string;
  /** Für die a11y-Namen und den Löschdialog: ohne ihn hiesse jedes ⋮-Menü
   *  gleich. */
  name: string;
  visibility: "public" | "private";
  teamId: string | null;
  angemeldet: boolean;
  bearbeitungsziel: Bearbeitungsziel | null;
  /** Die Teams des USERS — Ziele für Übernehmen und Ins-Team-Stellen. */
  teams: readonly TeamUebersicht[];
  /** Was dem Training zum Veröffentlichen fehlt. Ist etwas offen, führt der
   *  Menüeintrag direkt zum Hinweis statt zur Tragweite-Bestätigung. */
  fehlendeBedingungen: readonly FehlendeBedingung[];
  varianten: readonly Variante[];
  /** Die angezeigte Variante — sie reist an Durchführen, Drucken und
   *  Bearbeiten mit (#203 AK 1). */
  aktiveVarianteId?: string;
  /** Wohin die Rückmeldungen gehen. Der Editor führt bereits eine Snackbar am
   *  unteren Rand und reicht sie hier herein; zwei fest verankerte lägen sonst
   *  deckungsgleich übereinander. Ohne Angabe — auf der Ansichtsseite —
   *  bringt die Reihe ihre eigene mit. */
  melde?: (nachricht: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eigeneNotiz, setEigeneNotiz] = useState<string | null>(null);
  const setNotice = melde ?? setEigeneNotiz;
  const [sichtbarkeit, setSichtbarkeit] = useState<SichtbarkeitSchritt | null>(null);
  // Was die Datenebene zuletzt vermisst hat. Die Vorschau in
  // `fehlendeBedingungen` rechnet aus dem Stand, den diese Seite beim Rendern
  // sah; die Action sieht den Stand im Augenblick des Schreibens. Weichen sie
  // ab, gilt die Action — und genau dann ist die Vorschau leer, denn sonst
  // wäre es gar nicht erst zur Bestätigung gekommen.
  const [vermisst, setVermisst] = useState<FehlendeBedingung[] | null>(null);
  const [zielWahl, setZielWahl] = useState<"uebernehmen" | "ins_team_stellen" | null>(
    null,
  );
  const [loeschen, setLoeschen] = useState(false);

  const rechte = trainingAktionsRechte(
    { visibility, teamId },
    angemeldet,
    bearbeitungsziel,
    teams.length > 0,
  );
  const oeffentlich = visibility === "public";

  function ziel(pfad: string) {
    return mitVariante(pfad, aktiveVarianteId, varianten);
  }

  /** Übernehmen ohne eigenes Team: Es gibt nur ein mögliches Ziel, und eine
   *  Wahl mit einer Option ist bloss ein Klick mehr (AK 11). */
  function uebernehmenStarten() {
    if (teams.length > 0) {
      setZielWahl("uebernehmen");
      return;
    }
    uebernehmenJetzt({ art: "persoenlich" });
  }

  function uebernehmenJetzt(wahl: KopieZielWahl) {
    startTransition(async () => {
      const res = await uebernimmTraining(
        trainingId,
        wahl.art === "team" ? { art: "team", teamId: wahl.teamId } : { art: "persoenlich" },
      );
      setZielWahl(null);
      if (res.ok) {
        // PO-Entscheid Übungswelten-Epic: nach der Übernahme direkt zur Kopie —
        // bei Trainings wie bei Übungen.
        router.push(`/training/${res.trainingId}?uebernommen=1`);
      } else {
        setNotice(res.error);
      }
    });
  }

  function insTeamJetzt(wahl: KopieZielWahl) {
    if (wahl.art !== "team") return;
    startTransition(async () => {
      const res = await stelleInsTeam(trainingId, wahl.teamId);
      setZielWahl(null);
      if (res.ok) {
        router.refresh();
        setNotice(`Kopie in „${wahl.teamName}" gestellt.`);
      } else {
        setNotice(res.error);
      }
    });
  }

  function veroeffentlichenJetzt() {
    startTransition(async () => {
      const res = await veroeffentlicheTraining(trainingId);
      router.refresh();
      if (res.status === "published") {
        setSichtbarkeit(null);
        setNotice("Das Training ist jetzt öffentlich.");
      } else if (res.status === "incomplete") {
        // Zwischen zwei Blicken hat sich etwas geändert — die Bedingungen
        // stehen dann statt der Bestätigung da, nicht daneben. Genannt wird,
        // was die Action vermisst, nicht was die Vorschau vermisste: Die ist
        // an dieser Stelle leer.
        setVermisst(res.missing);
        setSichtbarkeit("unvollstaendig");
      } else {
        setSichtbarkeit(null);
        setNotice(res.error);
      }
    });
  }

  function aufEntwurfJetzt() {
    startTransition(async () => {
      const res = await setzeTrainingAufEntwurf(trainingId);
      setSichtbarkeit(null);
      router.refresh();
      setNotice(
        res.ok ? "Das Training ist wieder ein Entwurf." : (res.error ?? "Fehlgeschlagen."),
      );
    });
  }

  /* Die Einträge des Überlaufmenüs — immer in dieser Reihenfolge, was auch
     immer davon offensteht (AK 6). Löschen zuletzt und als einziges in
     Error-Schrift. */
  const eintraege: MenuItemDef[] = [];
  if (rechte.uebernehmen)
    eintraege.push({ label: "Übernehmen", icon: Download, onSelect: uebernehmenStarten });
  if (rechte.sichtbarkeit === "veroeffentlichen")
    eintraege.push({
      label: "Veröffentlichen",
      icon: Globe,
      onSelect: () => {
        setVermisst(null);
        setSichtbarkeit(fehlendeBedingungen.length > 0 ? "unvollstaendig" : "tragweite");
      },
    });
  if (rechte.sichtbarkeit === "auf_entwurf")
    eintraege.push({
      label: "Auf Entwurf setzen",
      icon: Undo2,
      onSelect: () => setSichtbarkeit("rueckzug"),
    });
  if (rechte.insTeamStellen)
    eintraege.push({
      label: "Ins Team stellen",
      icon: Users,
      onSelect: () => setZielWahl("ins_team_stellen"),
    });
  if (rechte.loeschen)
    eintraege.push({
      label: "Löschen",
      icon: Trash2,
      danger: true,
      onSelect: () => setLoeschen(true),
    });

  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 print:hidden">
        <Tooltip label="Durchführen">
          <IconButtonLink
            href={ziel(`/training/${trainingId}/durchfuehren`)}
            icon={Play}
            label={`„${name}" durchführen`}
            size="sm"
          />
        </Tooltip>

        {/* Drucken führt auf die eigene Druckansicht — dieselbe Adresse wie
            bisher, und darum auch im Editor verfügbar (AK 10): Was dort steht,
            ist längst gespeichert, es geht nichts verloren. */}
        <Tooltip label="Drucken">
          <IconButtonLink
            href={ziel(`/training/${trainingId}/druck`)}
            icon={Printer}
            label={`„${name}" drucken`}
            size="sm"
          />
        </Tooltip>

        {ort === "ansicht" && rechte.bearbeiten && (
          <Tooltip label="Bearbeiten">
            <IconButtonLink
              href={ziel(`/training/${trainingId}/edit`)}
              icon={Pencil}
              label={`„${name}" bearbeiten`}
              size="sm"
            />
          </Tooltip>
        )}

        {hatUeberlauf(rechte) && (
          <OverflowMenu
            label={`Weitere Aktionen zu „${name}"`}
            disabled={pending}
            items={eintraege}
          />
        )}
      </div>

      {/* Jeder Dialog nur, wo seine Aktion offensteht: Ein `<dialog>` steht
          auch geschlossen im Markup, und ein Löschdialog auf der Seite eines
          Betrachters, der nichts löschen darf, ist toter Text. */}
      {rechte.sichtbarkeit !== null && (
        <SichtbarkeitDialoge
          schritt={sichtbarkeit}
          onClose={() => setSichtbarkeit(null)}
          fehlend={vermisst ?? fehlendeBedingungen}
          varianten={varianten}
          pending={pending}
          onVeroeffentlichen={veroeffentlichenJetzt}
          onAufEntwurf={aufEntwurfJetzt}
        />
      )}

      {(rechte.uebernehmen || rechte.insTeamStellen) && (
        <TrainingZielDialog
          open={zielWahl !== null}
          onClose={() => setZielWahl(null)}
          modus={zielWahl ?? "uebernehmen"}
          teams={teams}
          pending={pending}
          onBestaetigen={zielWahl === "ins_team_stellen" ? insTeamJetzt : uebernehmenJetzt}
        />
      )}

      {rechte.loeschen && (
        <Dialog
          open={loeschen}
          onClose={() => setLoeschen(false)}
          title="Training löschen?"
          actions={
            <>
              <Button variant="text" onClick={() => setLoeschen(false)}>
                Abbrechen
              </Button>
              <form action={deleteTraining.bind(null, trainingId)}>
                <Button type="submit" variant="danger">
                  Endgültig löschen
                </Button>
              </form>
            </>
          }
        >
          <p>
            Das Training „{name}" und alle seine Übungszuordnungen werden
            unwiderruflich gelöscht.
          </p>
          {/* Beim öffentlichen Training ist das Löschen mehr als ein Aufräumen
              im eigenen Bestand: es verschwindet aus der Öffentlichkeit
              (Story A AK 8). */}
          {oeffentlich && (
            <p className="mt-3">
              Das Training verschwindet damit auch aus dem öffentlichen Bestand.
              Kopien, die andere bereits übernommen haben, bleiben bestehen.
            </p>
          )}
        </Dialog>
      )}

      {/* Nur wo die Reihe ihre Meldungen selbst trägt (Ansichtsseite). */}
      {!melde && (
        <Snackbar
          open={eigeneNotiz != null}
          message={eigeneNotiz ?? ""}
          onClose={() => setEigeneNotiz(null)}
          placement="fixed"
        />
      )}
    </>
  );
}
