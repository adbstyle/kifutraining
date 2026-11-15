"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button, ButtonLink, Dialog, NamenBestaetigen, SectionMessage, namenStimmen } from "@/components/ui";
import { deleteAccount, type KontoLoeschenZustand } from "@/lib/actions/auth";
import {
  KONTO_LOESCHEN_TEXT,
  kontoEinzigePersonSaetze,
  kontoLetzteVerwaltungSaetze,
} from "@/lib/verein";
import type { KontoLoeschInfo } from "@/lib/verein-antwort";

/* Konto-Löschung mit ausdrücklicher Bestätigung und Konsequenz-Hinweis
   (Story 9 EK2/EK3), in drei Fällen nach der Lage im Verein (#587 AK 12–14):

   - frei: das Konto geht allein; ein Verein bleibt bestehen.
   - letzte Verwaltung, weitere Personen im Verein: nichts zu bestätigen, der
     Dialog führt zur Verwaltung, wo sich jemand aufnehmen oder der Verein
     löschen lässt (#581 AK 34).
   - einzige Person im Verein: Mit dem Konto verschwindet der Verein; der Dialog
     nennt, was dazugehört, und verlangt den Vereinsnamen.

   Die Seite liest den Fall beim Rendern (`konto_loeschen_info`), die Datenebene
   prüft ihn beim Ausführen erneut. Hat sich die Lage inzwischen geändert, bleibt
   alles unverändert, der Dialog zeigt den Grund und, wo es weitergeht, den
   neuen Fall. Nach jeder Antwort ohne Löschen lädt er die Lage neu
   (`router.refresh()`); sobald sie da ist, gilt sie statt der Antwort. Die
   Meldung bleibt nur, wenn sie zur frischen Lage passt (`meldungBleibt`).
   Eine laufende Anfrage sperrt Eingabe und Knöpfe. */
export function KontoClient({ info }: { info: KontoLoeschInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Trash2 size={18} strokeWidth={2} aria-hidden />
        Konto löschen
      </Button>
      {/* Nur offen eingehängt: Schliessen verwirft die letzte Meldung. */}
      {open && <KontoLoeschenDialog info={info} onClose={() => setOpen(false)} />}
    </>
  );
}

const ANFANG: KontoLoeschenZustand = { fehler: null };
const FORM = "konto-loeschen";

/** Passt die Meldung der letzten Antwort zur neu geladenen Lage? Zur letzten
 *  Verwaltung nicht, wenn dieser Fall noch gilt: Dann nennen ihn die Sätze der
 *  Lage (sonst doppelt). Gilt ein anderer Fall, bleibt nur der neutrale Satz
 *  «Im Verein hat sich inzwischen etwas geändert …»; der Satz zur letzten
 *  Verwaltung widerspräche ihm. Zur einzigen Person (Name und Zahlen oder der
 *  neue Name) nur, solange dieser Fall gilt. Eine Meldung ohne Fall
 *  (technisch) bleibt. */
function meldungBleibt(z: KontoLoeschenZustand, fall: KontoLoeschInfo["fall"]): boolean {
  if (z.letzteVerwaltung) return fall !== "letzte_verwaltung" && z.fehler === KONTO_LOESCHEN_TEXT.weiterePerson;
  if (z.verein || z.aktuellerName !== undefined) return fall === "einzige_person";
  return true;
}

function KontoLoeschenDialog({ info, onClose }: { info: KontoLoeschInfo; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [zustand, setZustand] = useState<KontoLoeschenZustand>(ANFANG);
  const [eingabe, setEingabe] = useState("");

  // Neu geladene Lage (nach router.refresh): Sie ist frischer als die letzte
  // Antwort und entscheidet den Fall; die Meldung bleibt nur, wenn sie passt.
  const [infoStand, setInfoStand] = useState(info);
  if (info !== infoStand) {
    setInfoStand(info);
    setZustand((z) => ({ fehler: meldungBleibt(z, info.fall) ? z.fehler : null }));
  }

  // Der Fall, den die Datenebene beim Ausführen gesehen hat, geht dem der Seite vor.
  const gesperrt = zustand.letzteVerwaltung === true || info.fall === "letzte_verwaltung";
  const grundlage = zustand.verein ?? (info.fall === "einzige_person" ? { name: info.verein, teams: info.teams, spieler: info.spieler } : null);
  const verein = !gesperrt && grundlage ? { ...grundlage, name: zustand.aktuellerName ?? grundlage.name } : null;
  const passt = verein ? namenStimmen(eingabe, verein.name) : true;

  function loeschen() {
    if (pending || !passt) return;
    startTransition(async () => {
      // Gelingt es, leitet die Action selbst weiter und liefert nichts zurück.
      const neu = await deleteAccount(verein ? eingabe : null);
      // Name und Zahlen des Vereins gehen über Antwortfolgen nicht verloren
      // (etwa verein_bestaetigen, dann vereinsname_falsch).
      setZustand((vorher) => ({ ...neu, verein: neu.verein ?? (neu.letzteVerwaltung ? undefined : vorher.verein) }));
      router.refresh();
    });
  }

  const schliessen = () => !pending && onClose();
  const einzige = verein ? kontoEinzigePersonSaetze(verein.name, verein.teams, verein.spieler) : null;
  const letzte = info.fall === "letzte_verwaltung" ? kontoLetzteVerwaltungSaetze(info.verein) : null;

  return (
    <Dialog
      open
      onClose={schliessen}
      title={einzige ? einzige.titel : gesperrt ? KONTO_LOESCHEN_TEXT.nichtLoeschbar : KONTO_LOESCHEN_TEXT.titel}
      actions={
        <>
          <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
            {gesperrt ? "Schliessen" : "Abbrechen"}
          </Button>
          {gesperrt ? (
            <ButtonLink href="/verein/verwaltung" variant="filled">
              Zur Verwaltung
            </ButtonLink>
          ) : (
            <Button type="submit" form={FORM} variant="danger" disabled={!passt || pending}>
              {einzige ? einzige.knopf : "Konto endgültig löschen"}
            </Button>
          )}
        </>
      }
    >
      <form
        id={FORM}
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          loeschen();
        }}
      >
        {zustand.fehler && !einzige && <SectionMessage appearance="error">{zustand.fehler}</SectionMessage>}
        {letzte && (
          <>
            <p>{letzte.lage}</p>
            <p>{letzte.weg}</p>
          </>
        )}
        {!gesperrt && (
          <>
            {einzige ? (
              <>
                <p>{einzige.lage}</p>
                {einzige.geloescht.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">
                    {einzige.geloescht.map((zeile) => (
                      <li key={zeile}>{zeile}</li>
                    ))}
                  </ul>
                )}
                <p className="font-medium text-on-surface">{einzige.endgueltig}</p>
              </>
            ) : (
              <p className="flex items-start gap-2">
                <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-error" aria-hidden />
                <span>Diese Aktion kann nicht rückgängig gemacht werden.</span>
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5">
              <li>Deine <strong>öffentlichen</strong> Übungen bleiben anonymisiert erhalten und werden unveränderlich.</li>
              <li>Deine <strong>privaten</strong> Übungen werden samt Feld-Diagramm gelöscht.</li>
              {!einzige && (
                <>
                  <li>Teams, in denen du die letzte Trainer:in bist, bleiben ohne Trainer:in bestehen.</li>
                  <li>{KONTO_LOESCHEN_TEXT.vereinBleibt}</li>
                </>
              )}
              <li>Verbundene KI-Assistenten verlieren ihren Zugang.</li>
              <li>Du wirst abgemeldet und dein Konto entfernt.</li>
            </ul>
            {einzige && verein && (
              <NamenBestaetigen
                name={verein.name}
                wert={eingabe}
                onChange={setEingabe}
                label={einzige.feld}
                fehler={zustand.fehler}
                gesperrt={pending}
              />
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}
