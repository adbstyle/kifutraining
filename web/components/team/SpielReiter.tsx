"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Leerzustand, Lozenge, LozengeAuswahl, type Wechsel } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAnwesenheitAktion, setzeAufgebotAktion, setzeMeldungAktion } from "@/lib/actions/abmeldungen";
import { EHEMALIGE_SPIELERIN, spielerName } from "@/lib/spieler";
import {
  AUFGEBOT_TEXT,
  MELDUNG_TEXT,
  NACHTRAG_TEXT,
  meldefristVerpasst,
  richtwertStufeText,
  zaehlteBeimAnpfiff,
  zeitpunktKurz,
  type Meldung,
} from "@/lib/spiel";
import { MELDE_STATUS, TERMIN_STATUS, meldeStatus, spielStatus } from "@/lib/termin-status";
import type { SpielSpieler, SpielTeilnehmer } from "@/lib/kern/spiele";
import { seitWann } from "@/lib/zeit";
import { KADER_TEXT, uebrigeText } from "@/lib/kader";
import { cn } from "@/lib/cn";
import { useLokalerStand } from "@/lib/use-lokaler-stand";
import { KaderLozenges } from "./KaderLozenge";
import { EingrenzungLeer, KaderChips } from "./KaderEingrenzung";

/** Die Gruppen in ihrer Reihenfolge: zuerst, wer sich noch nicht geäussert
 *  hat — bei ihnen fragt das Team nach (Story #463), nach der Meldefrist als
 *  «Meldefrist verpasst» (#496); zuletzt die nicht Aufgebotenen, gleich welche
 *  Meldung sie tragen (#464). */
type Gruppe = "ohne" | "angemeldet" | "abgemeldet" | "nicht_aufgeboten";
const GRUPPEN: Gruppe[] = ["ohne", "angemeldet", "abgemeldet", "nicht_aufgeboten"];

/** Was unter dem Namen einer nicht Aufgebotenen steht: ihre Meldung (#464 AK 6). */
const UNTER_KENNZEICHNUNG: Record<"ohne" | "angemeldet" | "abgemeldet", string> = {
  ohne: "ohne Meldung",
  angemeldet: "war angemeldet",
  abgemeldet: "war abgemeldet",
};

/** Der Kopf des Reiters (#495 AK 1, 2): der Status des Spiels mit einem
 *  kurzen Detail, darunter die Zahl gross und ungefärbt. */
function Kopf({ zahl, gesamt, wort, min, max, children }: { zahl: number; gesamt: number; wort: string; min: number | null; max: number | null; children?: React.ReactNode }) {
  const status = spielStatus(zahl, min, max);
  return (
    <div className="flex flex-col gap-1">
      {status && (
        <div className="flex flex-wrap items-center gap-2">
          <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
          <span className="type-body-small text-on-surface-mittel">{richtwertStufeText(zahl, min, max)}</span>
        </div>
      )}
      <p className="type-headline-small text-on-surface">
        {zahl} von {gesamt} {wort}
      </p>
      {children}
    </div>
  );
}

/* Der Reiter «Spieler:innen» an einem Spiel (#463, #464; Epic #490, Tafel 4):
   wer ohne Meldung, angemeldet oder abgemeldet ist, in Gruppen. Jede Zeile
   trägt ihren Status als `LozengeAuswahl`: Ein Tipp darauf öffnet die
   möglichen Wechsel — «Anmelden» und «Abmelden» bis zum Anpfiff, auch nach
   der Meldefrist der Eltern, nach einem Trenner «Nicht aufbieten» bzw.
   «Aufbieten». Eine abgegebene Meldung lässt sich nicht zurück auf «ohne»
   setzen. Nach der Meldefrist heisst «ohne Meldung» «Meldefrist verpasst»
   (#496): Das Team rechnet nicht mit ihr, kann sie aber bis zum Anpfiff
   anfragen und melden.

   Oben der Status des Spiels mit Detail, die Zahl gross und ungefärbt, dazu,
   bis wann Eltern und Mitglieder melden. Kader wie bei Trainings. Ab dem
   Anpfiff gilt der Stand beim Anpfiff, nachgetragen wird in
   `SpielNachAnpfiff` (#487). */
export function SpielReiter({ teamId, daten }: { teamId: string; daten: SpielSpieler }) {
  const melde = useSnackbar();
  // Was gerade gemeldet oder gekennzeichnet wird, steht sofort so da.
  const meldungen = useLokalerStand<Meldung>(daten);
  const aufgebot = useLokalerStand<boolean>(daten);
  const pending = meldungen.pending || aufgebot.pending;
  const [gewaehlterKader, setKader] = useState<string | null>(null);
  const jeKader = useMemo(() => {
    const zahl = new Map<string, number>();
    for (const s of daten.spieler) for (const k of s.kader) zahl.set(k, (zahl.get(k) ?? 0) + 1);
    return zahl;
  }, [daten.spieler]);

  if (!daten.mitListe && daten.begonnen)
    return <p className="type-body-medium text-on-surface-mittel">Beim Anpfiff führte das Team keine Spielerliste.</p>;

  if (!daten.mitListe)
    return (
      <Leerzustand icon={Users} titel="Noch keine Spielerliste" dicht>
        Wer zu einem Spiel kommt, siehst du, sobald das Team eine Spielerliste führt. Sie steht unter{" "}
        <Link href={`/team/${teamId}/verwaltung`} className="focus-ring rounded-klein text-primary hover:underline">
          Team
        </Link>
        .
      </Leerzustand>
    );

  // #463 AK 19: Ein ausgefallenes Spiel zeigt weder Meldungen noch Zahl.
  if (daten.ausgefallen)
    return (
      <div className="flex flex-col items-start gap-2">
        <Lozenge appearance={TERMIN_STATUS.faelltAus.appearance}>{TERMIN_STATUS.faelltAus.wort}</Lozenge>
        <p className="type-body-medium text-on-surface-mittel">{MELDUNG_TEXT.ausgefallen}</p>
      </div>
    );

  if (daten.begonnen) return <SpielNachAnpfiff teamId={teamId} daten={daten} />;

  const meldungVon = (s: SpielTeilnehmer): Meldung => meldungen.wert(s.spielerId, s.meldung);
  const aufgebotVon = (s: SpielTeilnehmer): boolean => aufgebot.wert(s.spielerId, s.nichtAufgeboten);
  const gruppeVon = (s: SpielTeilnehmer): Gruppe => (aufgebotVon(s) ? "nicht_aufgeboten" : (meldungVon(s) ?? "ohne"));
  const gesehen = { datum: daten.datum, beginn: daten.beginn };
  // Eine nicht aufgebotene zählt nur als solche (#464 AK 7).
  const zahl = (g: Gruppe) => daten.spieler.filter((s) => gruppeVon(s) === g).length;
  const verpasst = daten.fristAbgelaufen;
  const ohneWort = verpasst ? MELDUNG_TEXT.verpasst : MELDUNG_TEXT.ohne;

  // Ein offenes Spiel hat keine Ehemaligen: Jede Zeile trägt ihre Kennung.
  const melden = (id: string, an: boolean) =>
    meldungen.aendere(
      id,
      an ? "angemeldet" : "abgemeldet",
      () => setzeMeldungAktion(teamId, { terminId: daten.terminId, spielerId: id, angemeldet: an, gesehen }),
      (r) => melde(r.error),
    );
  const aufbieten = (id: string, nichtAufgeboten: boolean) =>
    aufgebot.aendere(
      id,
      nichtAufgeboten,
      () => setzeAufgebotAktion(teamId, { terminId: daten.terminId, spielerId: id, nichtAufgeboten, gesehen }),
      (r) => melde(r.error),
    );

  const uebrige = uebrigeText(daten.uebrige);
  const kaderNamen = daten.kader.flatMap((k) => (k.name !== null ? [k.name] : []));
  const mitChips = kaderNamen.length > 1;
  const eingrenzung = mitChips && gewaehlterKader !== null && kaderNamen.includes(gewaehlterKader) ? gewaehlterKader : null;
  const sichtbar = eingrenzung === null ? daten.spieler : daten.spieler.filter((s) => s.kader.includes(eingrenzung));
  const melden_bis = daten.frist
    ? `Eltern melden bis ${zeitpunktKurz(daten.frist)}${verpasst ? " (abgelaufen)" : ""} · Mitglieder bis zum Anpfiff`
    : "Eltern und Mitglieder melden bis zum Anpfiff";
  const titel: Record<Gruppe, string> = {
    ohne: ohneWort,
    angemeldet: MELDUNG_TEXT.angemeldet,
    abgemeldet: MELDUNG_TEXT.abgemeldet,
    nicht_aufgeboten: AUFGEBOT_TEXT.nichtAufgeboten,
  };

  return (
    <div className="flex flex-col gap-3">
      {mitChips ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body-medium text-on-surface-mittel">Gilt für</span>
          <KaderChips
            label="Spieler:innen eingrenzen"
            chips={kaderNamen.map((name) => ({ schluessel: name, name, anzahl: jeKader.get(name) ?? 0 }))}
            gewaehlt={eingrenzung}
            onWahl={setKader}
          />
        </div>
      ) : (
        daten.kader.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 type-body-medium text-on-surface-mittel">
            Gilt für
            <KaderLozenges namen={daten.kader.map((k) => k.name)} />
          </p>
        )
      )}
      <Kopf zahl={zahl("angemeldet")} gesamt={daten.gesamt} wort="angemeldet" min={daten.richtwertMin} max={daten.richtwertMax}>
        <p className="type-body-small text-on-surface-mittel">
          {zahl("ohne")} {verpasst ? "Meldefrist verpasst" : "ohne Meldung"} · {zahl("abgemeldet")} abgemeldet
          {zahl("nicht_aufgeboten") > 0 && <> · {zahl("nicht_aufgeboten")} nicht aufgeboten</>}
        </p>
        <p className="type-body-small text-on-surface-mittel">{melden_bis}</p>
      </Kopf>
      {daten.gesamt === 0 && <p className="type-body-medium text-on-surface-mittel">{KADER_TEXT.niemand}</p>}
      {daten.gesamt > 0 && eingrenzung !== null && sichtbar.length === 0 && (
        <EingrenzungLeer titel={KADER_TEXT.leerKader(eingrenzung)} onAufheben={() => setKader(null)}>
          {KADER_TEXT.leerKaderTermin}
        </EingrenzungLeer>
      )}
      {GRUPPEN.map((g) => {
        const zeilen = sichtbar.filter((s) => gruppeVon(s) === g);
        if (zeilen.length === 0) return null;
        return (
          <section key={g} aria-label={`${titel[g]}: ${zeilen.length}`}>
            <h4 className="px-1 pb-1 type-label-medium uppercase tracking-wider text-on-surface-mittel">
              {titel[g]} · {zeilen.length}
            </h4>
            <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
              {zeilen.map((s, i) => (
                <SpielZeile
                  key={s.spielerId ?? `ehemalig-${i}`}
                  s={s}
                  meldung={meldungVon(s)}
                  nichtAufgeboten={aufgebotVon(s)}
                  fristAbgelaufen={verpasst}
                  eben={meldungen.hat(s.spielerId) && meldungVon(s) !== s.meldung}
                  gelesenAm={daten.gelesenAm}
                  pending={pending}
                  onMelden={(an) => s.spielerId && melden(s.spielerId, an)}
                  onAufgebot={(nein) => s.spielerId && aufbieten(s.spielerId, nein)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {uebrige && <p className="type-body-small text-on-surface-mittel">{uebrige}</p>}
    </div>
  );
}

function SpielZeile({
  s,
  meldung,
  nichtAufgeboten,
  fristAbgelaufen,
  eben,
  gelesenAm,
  pending,
  onMelden,
  onAufgebot,
}: {
  s: SpielTeilnehmer;
  meldung: Meldung;
  nichtAufgeboten: boolean;
  fristAbgelaufen: boolean;
  eben: boolean;
  gelesenAm: string;
  pending: boolean;
  onMelden: (an: boolean) => void;
  onAufgebot: (nichtAufgeboten: boolean) => void;
}) {
  const name = s.vorname !== null ? spielerName({ vorname: s.vorname, nachname: s.nachname ?? "" }) : EHEMALIGE_SPIELERIN;
  // Unter dem Namen: seit wann die Meldung gilt (#463 AK 25), sonst warum keine.
  // Nicht aufgeboten: darunter ihre Meldung (#464 AK 6, Design PO 2026-10-21).
  const zeile2 = [
    nichtAufgeboten
      ? UNTER_KENNZEICHNUNG[meldung ?? "ohne"]
      : eben
        ? "gerade eben"
        : s.gewechseltAm
          ? seitWann(s.gewechseltAm, gelesenAm)
          : s.verfallen
            ? "Meldung mit der Verlegung verfallen"
            : s.aufgebotVerfallen
              ? "Kennzeichnung mit der Verlegung verfallen"
              : meldefristVerpasst(meldung, nichtAufgeboten, fristAbgelaufen)
                ? "keine Meldung bis zur Frist"
                : meldung === null
                  ? "noch keine Meldung"
                  : null,
    ...s.kader,
  ]
    .filter(Boolean)
    .join(" · ");
  // Nur mögliche Wechsel (#495 AK 8, 9). Nicht aufgeboten nimmt das Spiel
  // keine Meldung an (#464 AK 4) — nur «Aufbieten», zurück zur Meldung darunter.
  const wechsel: Wechsel[] = nichtAufgeboten
    ? [{ handlung: AUFGEBOT_TEXT.aufbieten, ziel: meldeStatus(meldung, false, fristAbgelaufen), onSelect: () => onAufgebot(false) }]
    : [
        ...(meldung !== "angemeldet" ? [{ handlung: "Anmelden", ziel: MELDE_STATUS.angemeldet, onSelect: () => onMelden(true) }] : []),
        ...(meldung !== "abgemeldet" ? [{ handlung: "Abmelden", ziel: MELDE_STATUS.abgemeldet, onSelect: () => onMelden(false) }] : []),
        { handlung: AUFGEBOT_TEXT.nichtAufbieten, ziel: MELDE_STATUS.nichtAufgeboten, trenner: true, onSelect: () => onAufgebot(true) },
      ];
  const status = meldeStatus(meldung, nichtAufgeboten, fristAbgelaufen);
  return (
    <li className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate type-body-medium", meldung === "abgemeldet" || nichtAufgeboten || s.ehemalig ? "text-on-surface-mittel" : "text-on-surface")}>
          {name}
        </span>
        {zeile2 && <span className="block truncate type-body-small text-on-surface-mittel">{zeile2}</span>}
      </span>
      <LozengeAuswahl
        wort={status.wort}
        appearance={status.appearance}
        wechsel={wechsel}
        ariaLabel={`Status ${name}: ${status.wort}`}
        disabled={pending}
      />
    </li>
  );
}

/** Unter dem Namen, wer nicht (ohne Nachtrag) als angemeldet zählt: wie er
 *  beim Anpfiff stand. */
function warBeimAnpfiff(s: SpielTeilnehmer, fristAbgelaufen: boolean): string {
  if (s.nichtAufgeboten) return "war nicht aufgeboten";
  if (meldefristVerpasst(s.meldung, false, fristAbgelaufen)) return "hatte die Meldefrist verpasst";
  return s.meldung === null ? "war ohne Meldung" : `war ${s.meldung}`;
}

/* Ein begonnenes Spiel (#487; Epic #490, Tafel 5): der Stand beim Anpfiff in
   einer Liste. Jede Zeile nennt als `LozengeAuswahl` den Status beim Anpfiff
   — Angemeldet, Ohne Meldung bzw. Meldefrist verpasst, Abgemeldet, Nicht
   aufgeboten — oder den Nachtrag: «Nicht erschienen» bei einer, die zählte,
   «Doch erschienen» bei allen anderen. Ihr Menü bietet den Nachtrag oder,
   wenn es einen gibt, «Nachtrag zurücknehmen» zum Stand beim Anpfiff. Oben
   die Anwesenden mit dem Status des Spiels. Ehemalige stehen ohne Namen da
   und lassen sich nicht mehr ansprechen. */
function SpielNachAnpfiff({ teamId, daten }: { teamId: string; daten: SpielSpieler }) {
  const melde = useSnackbar();
  // Was gerade nachgetragen wird, steht sofort so da.
  const nachtraege = useLokalerStand<boolean>(daten);
  const nachgetragen = (s: SpielTeilnehmer) => nachtraege.wert(s.spielerId, s.nachgetragen);
  const anwesend = daten.spieler.filter((s) => zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten) !== nachgetragen(s)).length;

  function nachtragen(s: SpielTeilnehmer, nachtrag: boolean) {
    const id = s.spielerId;
    if (!id) return;
    nachtraege.aendere(
      id,
      nachtrag,
      () =>
        setzeAnwesenheitAktion(teamId, {
          terminId: daten.terminId,
          spielerId: id,
          da: zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten) !== nachtrag,
          gesehen: { datum: daten.datum, beginn: daten.beginn },
        }),
      (r) => melde(r.error),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {daten.kader.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 type-body-medium text-on-surface-mittel">
          Galt für
          <KaderLozenges namen={daten.kader.map((k) => k.name)} />
        </p>
      )}
      <Kopf zahl={anwesend} gesamt={daten.gesamt} wort="da" min={daten.richtwertMin} max={daten.richtwertMax}>
        <p className="type-body-small text-on-surface-mittel">{NACHTRAG_TEXT.kopf}</p>
      </Kopf>
      {daten.gesamt === 0 ? (
        <p className="type-body-medium text-on-surface-mittel">{KADER_TEXT.niemand}</p>
      ) : (
        <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
          {daten.spieler.map((s, i) => (
            <NachtragZeile
              key={s.spielerId ?? `ehemalig-${i}`}
              s={s}
              nachgetragen={nachgetragen(s)}
              fristAbgelaufen={daten.fristAbgelaufen}
              gelesenAm={daten.gelesenAm}
              pending={nachtraege.pending}
              onNachtrag={(n) => nachtragen(s, n)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NachtragZeile({
  s,
  nachgetragen,
  fristAbgelaufen,
  gelesenAm,
  pending,
  onNachtrag,
}: {
  s: SpielTeilnehmer;
  nachgetragen: boolean;
  fristAbgelaufen: boolean;
  gelesenAm: string;
  pending: boolean;
  onNachtrag: (nachtrag: boolean) => void;
}) {
  const name = s.vorname !== null ? spielerName({ vorname: s.vorname, nachname: s.nachname ?? "" }) : EHEMALIGE_SPIELERIN;
  const zaehlte = zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten);
  const da = zaehlte !== nachgetragen;
  const beimAnpfiff = meldeStatus(s.meldung, s.nichtAufgeboten, fristAbgelaufen);
  const nachtrag = zaehlte ? MELDE_STATUS.nichtErschienen : MELDE_STATUS.dochErschienen;
  const status = nachgetragen ? nachtrag : beimAnpfiff;
  const zeile2 = [zaehlte && !nachgetragen ? "angemeldet" : warBeimAnpfiff(s, fristAbgelaufen), s.gewechseltAm && seitWann(s.gewechseltAm, gelesenAm), ...s.kader]
    .filter(Boolean)
    .join(" · ");
  const wechsel: Wechsel[] = s.ehemalig
    ? []
    : nachgetragen
      ? [{ handlung: NACHTRAG_TEXT.zurueck, ziel: beimAnpfiff, hinweis: NACHTRAG_TEXT.zurueckHinweis, onSelect: () => onNachtrag(false) }]
      : [{ handlung: nachtrag.wort, ziel: nachtrag, onSelect: () => onNachtrag(true) }];
  return (
    <li className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate type-body-medium", da && !s.ehemalig ? "text-on-surface" : "text-on-surface-mittel")}>{name}</span>
        {zeile2 && <span className="block truncate type-body-small text-on-surface-mittel">{zeile2}</span>}
      </span>
      <LozengeAuswahl
        wort={status.wort}
        appearance={status.appearance}
        wechsel={wechsel}
        ariaLabel={`Status ${name}: ${status.wort}`}
        disabled={pending}
      />
    </li>
  );
}
