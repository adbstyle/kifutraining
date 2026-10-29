"use client";

import { absageOffen, trainerLuecke, trainerNameFuer, verantwortlicheVon, type Eingrenzung } from "@/lib/trainer";
import Link from "next/link";
import { CalendarPlus, Clock, LandPlot, Shirt } from "lucide-react";
import { Button, ButtonLink, Kalenderblatt, Lozenge, OverflowMenu, SectionMessage, Switch, TreffpunktListe, ZeichenZahl } from "@/components/ui";
import { cn } from "@/lib/cn";
import { tagOhneJahr } from "@/lib/monat";
import { plusTage } from "@/lib/serie";
import { zeitText } from "@/lib/termin";
import { datumKurz, terminBegonnen } from "@/lib/zeit";
import { richtwertStufeText, zeitpunktKurz } from "@/lib/spiel";
import { felderKurz } from "@/lib/termin-felder";
import { spielerzahlKurz, spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { terminHref } from "@/lib/team-ansicht";
import { TERMIN_STATUS, blattStand, handlungsMeldung, nachMeldefrist, terminStatus } from "@/lib/termin-status";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { useTerminAktionen } from "./TerminBereich";
import { terminMenue } from "./TerminHandgriffe";
import { KaderLozenges } from "./KaderLozenge";
import { TrainerLozenge, TrainerZahl } from "./TrainerZeichen";

/* Ein Termin als grosse Karte zuoberst im Trainingsplan (#403; Epic #490,
   Tafeln 2b und 2d): «Als Nächstes» ist der nächste Termin, der stattfindet.
   Grösser als die Zeilen und auf einer höheren Fläche, damit man ihn am
   Spielfeldrand nicht suchen muss.

   Von oben nach unten (Epic #518, Tafel «Als Nächstes»): der Kopf wie eine
   Zeile — weisses Kalenderblatt, Status samt Trainer-Lücke, Name, Zeit und
   Ort, das Menü —, dann EINE Linie mit Zeichen: Spieler:innen und Kader, bei
   einem Spiel die Meldefrist, die Trainer:innen (dabei/eingeladen), bei einem
   Training der Platz. Die Einzelheiten stehen im Satz jedes Zeichens und am
   geöffneten Termin. Bei einem Spiel darunter die Treffpunkte, der späteste
   zuoberst: Die Trainer:in steht am Treffpunkt nächst am Spiel. Dann die
   Bemerkung (#403 AK 3), wer verantwortlich ist (#519 AK 24) und zuunterst
   die Handgriffe, der wichtigste umgekehrt. Die Serie steht am geöffneten Termin.

   `hervorgehoben`: Der Verweis aus dem Kalender-Abo zielt auf ihn (PC 4) —
   Kontur in Primary, `aria-current` und Sprungziel wie an jeder Zeile. */
export function NaechsterTermin({
  t,
  heute,
  jetzt,
  ich,
  eingrenzung,
  hervorgehoben,
  naechster = true,
  tagesUeberschrift = false,
}: {
  t: TerminZeile;
  heute: string;
  /** `YYYY-MM-DDTHH:MM` am Trainingsort, für die Meldefrist (#494). */
  jetzt: string;
  ich: string;
  eingrenzung: Eingrenzung | null;
  hervorgehoben: boolean;
  /** `false`: ein Spiel nach der Meldefrist in der Liste, nicht «Als Nächstes» (#494). */
  naechster?: boolean;
  /** In der Liste der erste Termin seines Tages: Das Blatt ist dessen Überschrift. */
  tagesUeberschrift?: boolean;
}) {
  const a = useTerminAktionen();
  const zeit = zeitText(t.beginn, t.ende);
  const grundStatus = terminStatus(t, heute);
  // Nur auf der grossen Karte: Ein Training, das als Nächstes ansteht und
  // noch nicht vorbereitet ist, mahnt in der Warnfarbe; in der Liste bleibt
  // es grau (PO 2026-10-22).
  const status =
    grundStatus === TERMIN_STATUS.nichtVorbereitet ? { ...grundStatus, appearance: "warning" as const } : grundStatus;
  const nachFrist = nachMeldefrist(t, jetzt);
  const handlung = nachFrist ? handlungsMeldung(t) : null;
  const name = t.spiel ? t.spiel.bezeichnung : t.training ? t.training.name : "Noch kein Training";
  const oeffnen = terminHref(t.teamId, eingrenzung, t.id);
  // #403 AK 8: Heute oder Morgen über dem Namen des nächsten Termins.
  const relativ = !naechster ? null : t.datum === heute ? "Heute" : t.datum === plusTage(heute, 1) ? "Morgen" : null;
  // Die Karte «Als Nächstes» trägt ihre Überschrift; in der Liste ist das Blatt die des Tages.
  const NameElement = naechster ? "h4" : "p";
  return (
    <div
      id={t.id}
      data-datum={t.datum}
      aria-current={hervorgehoben ? "true" : undefined}
      tabIndex={-1}
      className={cn(
        // Eine Stufe höher als die Karten der Tage darunter: abgehoben (AK 1).
        "relative rounded-flaeche bg-elev-04 p-4 outline-none focus:border-primary",
        naechster && "mt-2",
        hervorgehoben ? "kontur border-primary" : "kontur border-kante",
      )}
    >
      {/* Die ganze Karte öffnet den Termin daneben (#435), wie eine Zeile des
          Plans. Der Inhalt liegt darüber und lässt Klicks durch — ausser auf
          seine eigenen Links, Knöpfe und den Schalter samt Beschriftung. Für
          Tastatur und Vorlesehilfe öffnet der Name. */}
      <Link href={oeffnen} scroll={false} tabIndex={-1} aria-hidden className="absolute inset-0 rounded-flaeche" />
      <div className="pointer-events-none relative flex flex-col gap-3.5 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_label]:pointer-events-auto">
        <div className="flex items-start gap-4">
          <Kalenderblatt datum={t.datum} stand={blattStand(t, heute)} as={tagesUeberschrift ? "h5" : "div"} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            {relativ && (
              <p className="type-title-small text-on-surface-mittel">
                {relativ} · {tagOhneJahr(t.datum)}
              </p>
            )}
            {(status || trainerLuecke(t, heute)) && (
              <span className="flex flex-wrap items-center gap-1">
                {status && <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>}
                <TrainerLozenge t={t} heute={heute} />
              </span>
            )}
            <NameElement className="type-title-large max-w-full text-on-surface">
              <Link href={oeffnen} scroll={false} className="focus-ring rounded-klein hover:underline">
                <span className="sr-only">{naechster ? "Nächster Termin" : "Spiel nach der Meldefrist"}, {tagOhneJahr(t.datum)}: </span>
                {name}
              </Link>
            </NameElement>
            <p className="type-body-medium text-on-surface-mittel">{[zeit, t.ort].filter(Boolean).join(" · ")}</p>
          </div>
          <OverflowMenu
            label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
            items={[
              ...(t.training ? [{ label: "Training ersetzen", icon: CalendarPlus, onSelect: () => a.zuordnen(t) }] : []),
              ...terminMenue(t, a),
            ]}
          />
        </div>

        {/* #494: Nach der Meldefrist meldet sich niemand mehr von selbst — die
            Karte sagt, was vor dem Anpfiff zu tun ist. `status`, damit beim
            Laden nicht jede Karte als Alarm vorgelesen wird. */}
        {handlung && (
          <SectionMessage appearance={handlung.appearance} role="status">
            {handlung.text}
          </SectionMessage>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-linie pt-3 text-on-surface">
          <SpielerZeichen t={t} nachFrist={nachFrist} />
          {t.kader.length > 0 && <KaderLozenges namen={t.kader.map((k) => k.name)} />}
          {t.spiel?.meldefrist && (
            <ZeichenZahl icon={Clock} label={`Meldefrist ${nachFrist ? "abgelaufen " : ""}${zeitpunktKurz(t.spiel.meldefrist)}`}>
              Frist {zeitpunktKurz(t.spiel.meldefrist)}
            </ZeichenZahl>
          )}
          <TrainerZahl t={t} ich={ich} />
          {!t.spiel && (
            <ZeichenZahl icon={LandPlot} label={`Platz: ${felderKurz(t.felder) ?? "nicht erfasst"}`}>
              {felderKurz(t.felder) ?? "Platz nicht erfasst"}
            </ZeichenZahl>
          )}
        </div>
        {t.spiel && t.spiel.treffpunkte.length > 0 && (
          <TreffpunktListe
            treffpunkte={[...t.spiel.treffpunkte].reverse()}
            spieltag={t.datum}
            spielOrt={t.ort}
            className="type-body-medium text-on-surface"
          />
        )}
        {t.bemerkung && <p className="whitespace-pre-line type-body-medium text-on-surface">{t.bemerkung}</p>}
        <IchBinDabei t={t} />

        <div className="flex flex-wrap gap-2">
          {t.training ? (
            <>
              <ButtonLink variant="umkehr" href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`}>Durchführen</ButtonLink>
              <ButtonLink variant="outlined" href={`/training/${t.training.id}`}>Training öffnen</ButtonLink>
            </>
          ) : (
            !t.spiel && (
              <Button variant="umkehr" aria-haspopup="dialog" onClick={() => a.zuordnen(t)}>Training hinzufügen</Button>
            )
          )}
          {/* Wer kommt (#435) — sobald das Team eine Spielerliste führt. */}
          {t.spielstand && (
            <ButtonLink variant="outlined" href={terminHref(t.teamId, eingrenzung, t.id, "spieler")} scroll={false}>Spieler:innen</ButtonLink>
          )}
          <ButtonLink variant="outlined" href={terminHref(t.teamId, eingrenzung, t.id, "trainer")} scroll={false}>Trainer:innen</ButtonLink>
          {t.spiel && <ButtonLink variant="outlined" href={oeffnen} scroll={false}>Spiel öffnen</ButtonLink>}
        </div>
      </div>
    </div>
  );
}


/** Der eigene Stand als Schalter (#520 AK 18, 20; Tafel «Als Nächstes»):
 *  an = dabei. Wer nicht eingeladen ist, lädt sich mit dem Umlegen ein (wie
 *  «Ich helfe aus»). Daneben, wer verantwortlich ist (#519 AK 24). Ab Beginn
 *  und an einem ausgefallenen Termin gesperrt. */
function IchBinDabei({ t }: { t: TerminZeile }) {
  const a = useTerminAktionen();
  const ich = t.trainer.find((x) => x.userId === a.ich);
  const offen = absageOffen(t, terminBegonnen(t.datum, t.beginn));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Auch ein Tipp auf die Beschriftung legt um, statt den Termin zu öffnen. */}
      <label className="flex cursor-pointer items-center gap-3">
        <Switch
          checked={!!ich && !ich.abgesagtAm}
          disabled={!offen || a.pending}
          aria-label="Ich bin dabei"
          onChange={(e) =>
            ich ? a.absagen(t, ich, !e.target.checked) : a.trainer(t, { einladen: [a.ich] }, "Du bist eingeladen.")
          }
        />
        <span aria-hidden className="type-body-medium text-on-surface">Ich bin dabei</span>
      </label>
      <span className="type-body-small text-on-surface-mittel">
        {[verantwortlichZeile(t, a.ich), ich?.abgesagtAm && "du hast abgesagt", !ich && "du bist nicht eingeladen"]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}

/** «du bist verantwortlich», «Anna Keller verantwortlich» oder «niemand verantwortlich» (#519 AK 24). */
function verantwortlichZeile(t: TerminZeile, ich: string): string {
  const v = verantwortlicheVon(t.trainer);
  if (!v) return "niemand verantwortlich";
  return v.userId === ich ? "du bist verantwortlich" : `${trainerNameFuer(v, ich)} verantwortlich`;
}

/** Wie viele kommen, als Zahl mit Zeichen; der Satz nennt die Einzelheiten —
 *  beim Training die Abgemeldeten, beim Spiel den Richtwert und wer noch ohne
 *  Meldung ist. Ohne Spielerliste die erwartete Zahl (Training) bzw. dass
 *  nicht gemeldet wird (Spiel). */
function SpielerZeichen({ t, nachFrist }: { t: TerminZeile; nachFrist: boolean }) {
  const z = spielerzahlVon(t);
  const kurz = spielerzahlKurz(z);
  const s = t.spielstand;
  if (!kurz) {
    return (
      <ZeichenZahl icon={Shirt} label={t.spiel ? "Das Team führt keine Spielerliste – hier wird nicht gemeldet." : "Spielerzahl nicht erfasst"}>
        –
      </ZeichenZahl>
    );
  }
  const details = !s
    ? []
    : t.spiel
      ? [
          richtwertStufeText(s.anwesend ?? s.angemeldet, t.spiel.richtwertMin, t.spiel.richtwertMax),
          s.anwesend == null && (s.ohne_meldung ?? 0) > 0 && `${s.ohne_meldung} ${nachFrist ? "Meldefrist verpasst" : "ohne Meldung"}`,
        ]
      : // «nicht angemeldet» statt «abgemeldet»: Probe-Spieler:innen haben sich nicht abgemeldet (#555).
        [s.anwesend == null && `${s.gesamt - s.angemeldet} nicht angemeldet`];
  const label = [`Spieler:innen: ${spielerzahlLang(z)}`, ...details].filter(Boolean).join(" · ");
  return (
    <ZeichenZahl icon={Shirt} label={label}>
      {kurz}
    </ZeichenZahl>
  );
}
