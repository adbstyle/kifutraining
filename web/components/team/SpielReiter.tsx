"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { ChipMenu, Leerzustand, RichtwertLozenge, richtwertSchrift } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAnwesenheitAktion, setzeAufgebotAktion, setzeMeldungAktion } from "@/lib/actions/abmeldungen";
import { EHEMALIGE_SPIELERIN, spielerName } from "@/lib/spieler";
import { AUFGEBOT_TEXT, MELDUNG_TEXT, NACHTRAG_TEXT, meldungText, zaehlteBeimAnpfiff, zeitpunktKurz, type Meldung } from "@/lib/spiel";
import type { SpielSpieler, SpielTeilnehmer } from "@/lib/kern/spiele";
import { seitWann } from "@/lib/zeit";
import { KADER_TEXT, uebrigeText } from "@/lib/kader";
import { cn } from "@/lib/cn";
import { KaderLozenges } from "./KaderLozenge";
import { EingrenzungLeer, KaderChips } from "./KaderEingrenzung";

/** Der Punkt einer Meldung im Status-Chip: grau ohne, grün angemeldet, rot
 *  abgemeldet — wie die Lozenges der Eltern (PO 2026-10-21). */
const PUNKT: Record<"ohne" | "angemeldet" | "abgemeldet", string> = {
  ohne: "bg-on-surface-mittel",
  angemeldet: "bg-on-lozenge-success",
  abgemeldet: "bg-error",
};

/** Die Gruppen in ihrer Reihenfolge: zuerst, wer sich noch nicht geäussert
 *  hat — bei ihnen fragt das Team nach (Story #463); zuletzt die nicht
 *  Aufgebotenen, gleich welche Meldung sie tragen (#464). */
const GRUPPEN: { meldung: Meldung | "nicht_aufgeboten"; titel: string }[] = [
  { meldung: null, titel: "Ohne Meldung" },
  { meldung: "angemeldet", titel: "Angemeldet" },
  { meldung: "abgemeldet", titel: "Abgemeldet" },
  { meldung: "nicht_aufgeboten", titel: AUFGEBOT_TEXT.nichtAufgeboten },
];

/** Was unter dem Namen einer nicht Aufgebotenen steht: ihre Meldung (#464 AK 6). */
const UNTER_KENNZEICHNUNG: Record<"ohne" | "angemeldet" | "abgemeldet", string> = {
  ohne: "ohne Meldung",
  angemeldet: "war angemeldet",
  abgemeldet: "war abgemeldet",
};

/* Der Reiter «Spieler:innen» an einem Spiel (#463 AK 2, 5, 6, 7, 10, 20, 25):
   wer ohne Meldung, angemeldet oder abgemeldet ist, in Gruppen. Jede Zeile
   trägt ihre Meldung als Chip mit Menü (PO 2026-10-21, Design-Entscheid):
   «Anmelden» und «Abmelden» bis zum Anpfiff, auch nach der Meldefrist der
   Eltern. Eine abgegebene Meldung lässt sich nicht zurück auf «ohne» setzen.
   Dazu «Nicht aufbieten» (#464): Die Spieler:in steht dann in der letzten
   Gruppe, ihre Meldung darunter, bis «Aufbieten» das wieder aufhebt.

   Oben die Zahl der Angemeldeten gegen den Richtwert, farbig und in Worten,
   dazu, bis wann Eltern und Mitglieder melden. Kader wie bei Trainings. Ab
   dem Anpfiff gilt der Stand beim Anpfiff, nachgetragen wird in
   `SpielNachAnpfiff` (#487). */
export function SpielReiter({ teamId, daten }: { teamId: string; daten: SpielSpieler }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // Was gerade gemeldet wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, Meldung>>({});
  const [lokalAufgebot, setLokalAufgebot] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setLokal({});
    setLokalAufgebot({});
  }, [daten]);
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

  if (daten.ausgefallen) return <p className="type-body-medium text-on-surface-mittel">{MELDUNG_TEXT.ausgefallen}</p>;

  if (daten.begonnen) return <SpielNachAnpfiff teamId={teamId} daten={daten} />;

  const meldungVon = (s: SpielTeilnehmer): Meldung => (s.spielerId && s.spielerId in lokal ? lokal[s.spielerId] : s.meldung);
  const aufgebotVon = (s: SpielTeilnehmer): boolean =>
    s.spielerId && s.spielerId in lokalAufgebot ? lokalAufgebot[s.spielerId] : s.nichtAufgeboten;
  // Eine nicht aufgebotene zählt nur als solche (#464 AK 7).
  const nicht = daten.spieler.filter(aufgebotVon).length;
  const angemeldet = daten.spieler.filter((s) => !aufgebotVon(s) && meldungVon(s) === "angemeldet").length;
  const abgemeldet = daten.spieler.filter((s) => !aufgebotVon(s) && meldungVon(s) === "abgemeldet").length;
  const ohne = daten.spieler.length - angemeldet - abgemeldet - nicht;

  function melden(s: SpielTeilnehmer, an: boolean) {
    const id = s.spielerId;
    if (!id) return;
    setLokal((l) => ({ ...l, [id]: an ? "angemeldet" : "abgemeldet" }));
    startTransition(async () => {
      const r = await setzeMeldungAktion(teamId, {
        terminId: daten.terminId,
        spielerId: id,
        angemeldet: an,
        gesehen: { datum: daten.datum, beginn: daten.beginn },
      });
      if (!r.ok) {
        setLokal((l) => {
          const { [id]: _weg, ...rest } = l;
          return rest;
        });
        melde(r.error);
      }
      router.refresh();
    });
  }

  function aufbieten(s: SpielTeilnehmer, nichtAufgeboten: boolean) {
    const id = s.spielerId;
    if (!id) return;
    setLokalAufgebot((l) => ({ ...l, [id]: nichtAufgeboten }));
    startTransition(async () => {
      const r = await setzeAufgebotAktion(teamId, {
        terminId: daten.terminId,
        spielerId: id,
        nichtAufgeboten,
        gesehen: { datum: daten.datum, beginn: daten.beginn },
      });
      if (!r.ok) {
        setLokalAufgebot((l) => {
          const { [id]: _weg, ...rest } = l;
          return rest;
        });
        melde(r.error);
      }
      router.refresh();
    });
  }

  const uebrige = uebrigeText(daten.uebrige);
  const kaderNamen = daten.kader.flatMap((k) => (k.name !== null ? [k.name] : []));
  const mitChips = kaderNamen.length > 1;
  const eingrenzung = mitChips && gewaehlterKader !== null && kaderNamen.includes(gewaehlterKader) ? gewaehlterKader : null;
  const sichtbar = eingrenzung === null ? daten.spieler : daten.spieler.filter((s) => s.kader.includes(eingrenzung));
  const farbe = richtwertSchrift(angemeldet, daten.richtwertMin, daten.richtwertMax);
  const melden_bis = daten.frist
    ? `Eltern melden bis ${zeitpunktKurz(daten.frist)}${daten.fristAbgelaufen ? " (abgelaufen)" : ""} · Mitglieder bis zum Anpfiff`
    : "Eltern und Mitglieder melden bis zum Anpfiff";

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
      <div className="flex flex-col gap-1">
        <p className="type-body-medium text-on-surface-mittel">
          <span className={cn("type-headline-small", farbe ?? "text-on-surface")}>{angemeldet}</span> von {daten.gesamt} angemeldet
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RichtwertLozenge zahl={angemeldet} min={daten.richtwertMin} max={daten.richtwertMax} />
          <span className="type-body-small text-on-surface-mittel">
            {ohne} ohne Meldung · {abgemeldet} abgemeldet
            {nicht > 0 && <> · {nicht} nicht aufgeboten</>}
          </span>
        </div>
        <p className="type-body-small text-on-surface-mittel">{melden_bis}</p>
      </div>
      {daten.gesamt === 0 && <p className="type-body-medium text-on-surface-mittel">{KADER_TEXT.niemand}</p>}
      {daten.gesamt > 0 && eingrenzung !== null && sichtbar.length === 0 && (
        <EingrenzungLeer titel={KADER_TEXT.leerKader(eingrenzung)} onAufheben={() => setKader(null)}>
          {KADER_TEXT.leerKaderTermin}
        </EingrenzungLeer>
      )}
      {GRUPPEN.map((g) => {
        const zeilen = sichtbar.filter((s) =>
          g.meldung === "nicht_aufgeboten" ? aufgebotVon(s) : !aufgebotVon(s) && meldungVon(s) === g.meldung,
        );
        if (zeilen.length === 0) return null;
        return (
          <section key={g.titel} aria-label={`${g.titel}: ${zeilen.length}`}>
            <h4 className="px-1 pb-1 type-label-medium text-on-surface-mittel">
              {g.titel} · {zeilen.length}
            </h4>
            <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
              {zeilen.map((s, i) => (
                <SpielZeile
                  key={s.spielerId ?? `ehemalig-${i}`}
                  s={s}
                  meldung={meldungVon(s)}
                  nichtAufgeboten={aufgebotVon(s)}
                  eben={s.spielerId !== null && s.spielerId in lokal && lokal[s.spielerId] !== s.meldung}
                  gelesenAm={daten.gelesenAm}
                  pending={pending}
                  onMelden={(an) => melden(s, an)}
                  onAufgebot={(nein) => aufbieten(s, nein)}
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
  eben,
  gelesenAm,
  pending,
  onMelden,
  onAufgebot,
}: {
  s: SpielTeilnehmer;
  meldung: Meldung;
  nichtAufgeboten: boolean;
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
              : meldung === null
                ? "noch keine Meldung"
                : null,
    ...s.kader,
  ]
    .filter(Boolean)
    .join(" · ");
  // Nicht aufgeboten nimmt das Spiel keine Meldung an (#464 AK 4) — nur «Aufbieten».
  const items = nichtAufgeboten
    ? [{ label: AUFGEBOT_TEXT.aufbieten, onSelect: () => onAufgebot(false) }]
    : [
        ...(meldung !== "angemeldet" ? [{ label: "Anmelden", onSelect: () => onMelden(true) }] : []),
        ...(meldung !== "abgemeldet" ? [{ label: "Abmelden", onSelect: () => onMelden(false) }] : []),
        { label: AUFGEBOT_TEXT.nichtAufbieten, onSelect: () => onAufgebot(true) },
      ];
  const status = nichtAufgeboten ? AUFGEBOT_TEXT.nichtAufgeboten : meldungText(meldung);
  return (
    <li className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate type-body-medium", meldung === "abgemeldet" || nichtAufgeboten || s.ehemalig ? "text-on-surface-mittel" : "text-on-surface")}>
          {name}
        </span>
        {zeile2 && <span className="block truncate type-body-small text-on-surface-mittel">{zeile2}</span>}
      </span>
      <ChipMenu
        label={status}
        ariaLabel={`${name}: ${status}, Meldung ändern`}
        leading={<span aria-hidden className={cn("size-2 shrink-0 rounded-full", nichtAufgeboten ? "bg-error" : PUNKT[meldung ?? "ohne"])} />}
        items={items}
        disabled={pending}
        menuClassName="right-0"
      />
    </li>
  );
}

/** Der Status beim Anpfiff, wie ihn der Chip ohne Nachtrag nennt. */
function statusBeimAnpfiff(s: SpielTeilnehmer): string {
  return s.nichtAufgeboten ? AUFGEBOT_TEXT.nichtAufgeboten : meldungText(s.meldung);
}

/** Unter dem Namen, wer nicht (ohne Nachtrag) als angemeldet zählt: wie er
 *  beim Anpfiff stand. */
function warBeimAnpfiff(s: SpielTeilnehmer): string {
  if (s.nichtAufgeboten) return "war nicht aufgeboten";
  return s.meldung === null ? "war ohne Meldung" : `war ${s.meldung}`;
}

/* Ein begonnenes Spiel (#487 AK 1–3, 8–11; Design PO 2026-10-21): der Stand
   beim Anpfiff in einer Liste. Jeder Chip nennt den Status beim Anpfiff —
   Angemeldet, Ohne Meldung, Abgemeldet, Nicht aufgeboten — oder den
   Nachtrag: «Nicht erschienen» bei einer, die zählte, «Doch erschienen» bei
   allen anderen. Sein Menü bietet den Nachtrag oder, wenn es einen gibt, die
   Rückkehr zum Stand beim Anpfiff. Oben die Anwesenden gegen den Richtwert.
   Ehemalige stehen ohne Namen da und lassen sich nicht mehr ansprechen. */
function SpielNachAnpfiff({ teamId, daten }: { teamId: string; daten: SpielSpieler }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // Was gerade nachgetragen wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  useEffect(() => setLokal({}), [daten]);
  const nachgetragen = (s: SpielTeilnehmer) => (s.spielerId && s.spielerId in lokal ? lokal[s.spielerId] : s.nachgetragen);
  const anwesend = daten.spieler.filter((s) => zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten) !== nachgetragen(s)).length;

  function nachtragen(s: SpielTeilnehmer, nachtrag: boolean) {
    const id = s.spielerId;
    if (!id) return;
    setLokal((l) => ({ ...l, [id]: nachtrag }));
    startTransition(async () => {
      const r = await setzeAnwesenheitAktion(teamId, {
        terminId: daten.terminId,
        spielerId: id,
        da: zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten) !== nachtrag,
        gesehen: { datum: daten.datum, beginn: daten.beginn },
      });
      if (!r.ok) {
        setLokal((l) => {
          const { [id]: _weg, ...rest } = l;
          return rest;
        });
        melde(r.error);
      }
      router.refresh();
    });
  }

  const farbe = richtwertSchrift(anwesend, daten.richtwertMin, daten.richtwertMax);
  return (
    <div className="flex flex-col gap-3">
      {daten.kader.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 type-body-medium text-on-surface-mittel">
          Galt für
          <KaderLozenges namen={daten.kader.map((k) => k.name)} />
        </p>
      )}
      <div className="flex flex-col gap-1">
        <p className="type-body-medium text-on-surface-mittel">
          <span className={cn("type-headline-small", farbe ?? "text-on-surface")}>{anwesend}</span> von {daten.gesamt} da
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RichtwertLozenge zahl={anwesend} min={daten.richtwertMin} max={daten.richtwertMax} />
          <span className="type-body-small text-on-surface-mittel">{NACHTRAG_TEXT.kopf}</span>
        </div>
      </div>
      {daten.gesamt === 0 ? (
        <p className="type-body-medium text-on-surface-mittel">{KADER_TEXT.niemand}</p>
      ) : (
        <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
          {daten.spieler.map((s, i) => (
            <NachtragZeile
              key={s.spielerId ?? `ehemalig-${i}`}
              s={s}
              nachgetragen={nachgetragen(s)}
              gelesenAm={daten.gelesenAm}
              pending={pending}
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
  gelesenAm,
  pending,
  onNachtrag,
}: {
  s: SpielTeilnehmer;
  nachgetragen: boolean;
  gelesenAm: string;
  pending: boolean;
  onNachtrag: (nachtrag: boolean) => void;
}) {
  const name = s.vorname !== null ? spielerName({ vorname: s.vorname, nachname: s.nachname ?? "" }) : EHEMALIGE_SPIELERIN;
  const zaehlte = zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten);
  const da = zaehlte !== nachgetragen;
  const status = nachgetragen ? (zaehlte ? NACHTRAG_TEXT.nichtErschienen : NACHTRAG_TEXT.dochErschienen) : statusBeimAnpfiff(s);
  const zeile2 = [zaehlte && !nachgetragen ? "angemeldet" : warBeimAnpfiff(s), s.gewechseltAm && seitWann(s.gewechseltAm, gelesenAm), ...s.kader]
    .filter(Boolean)
    .join(" · ");
  // Grün, wer da war; grau, wer ohne Meldung und ohne Nachtrag blieb; sonst rot.
  const punkt = da ? PUNKT.angemeldet : !nachgetragen && s.meldung === null && !s.nichtAufgeboten ? PUNKT.ohne : PUNKT.abgemeldet;
  const items = s.ehemalig
    ? []
    : nachgetragen
      ? [{ label: NACHTRAG_TEXT.zurueck(statusBeimAnpfiff(s)), onSelect: () => onNachtrag(false) }]
      : [{ label: zaehlte ? NACHTRAG_TEXT.nichtErschienen : NACHTRAG_TEXT.dochErschienen, onSelect: () => onNachtrag(true) }];
  return (
    <li className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate type-body-medium", da && !s.ehemalig ? "text-on-surface" : "text-on-surface-mittel")}>{name}</span>
        {zeile2 && <span className="block truncate type-body-small text-on-surface-mittel">{zeile2}</span>}
      </span>
      <ChipMenu
        label={status}
        ariaLabel={`${name}: ${status}${s.ehemalig ? "" : ", nachtragen"}`}
        leading={<span aria-hidden className={cn("size-2 shrink-0 rounded-full", punkt)} />}
        items={items}
        disabled={pending || s.ehemalig}
        menuClassName="right-0"
      />
    </li>
  );
}
