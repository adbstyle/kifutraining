import { ArrowLeft } from "lucide-react";
import { ButtonLink, Disclosure, GegliederterText, TextMitLinks } from "@/components/ui";
import { PROBE_TEXT, linkProbeKopf } from "@/lib/probe";
import {
  LINK_INFOS,
  angabenSehenText,
  linkMeldenText,
  linkMeldenTitel,
  linkSchnuppernTitel,
  spielerName,
} from "@/lib/spieler";
import { teamInfosLinkTitel, teamInfosStand } from "@/lib/team-infos";

/* Die Infos am privaten Link (#598 AK 10): an einem Ort, was die
   Spielervertretung nachlesen will, aber beim Melden nicht braucht — jeder
   Abschnitt zugeklappt, auch beim ersten Öffnen (OoS 9, PO 2026-11-18).

   Gehört die Spieler:in einem Team an: wie man meldet und die Infos zum Team
   jedes Teams, das welche führt (AK 5, 6; ohne Infos kein Abschnitt, PC 1) —
   oder, solange sie schnuppert, wie das Schnuppern geht und das
   Info-Schreiben (AK 10). Immer: wer die Angaben sieht und dafür
   verantwortlich ist (Story #580 PC 4, #587 PC 2). */
export function LinkInfos({
  token,
  teams,
  spieler,
  verein,
  schnuppert,
  probeInfo,
  teamInfos,
}: {
  token: string;
  teams: string[];
  spieler: { vorname: string; nachname: string };
  verein: string;
  schnuppert: boolean;
  probeInfo: string | null;
  teamInfos: { team: string; text: string; stand: string }[];
}) {
  const name = spielerName(spieler);
  const { vorname } = spieler;
  return (
    <>
      {/* Zurück wie in den Benachrichtigungen: derselbe ruhige Knopf über dem Titel. */}
      <header className="flex flex-col items-start gap-2 border-b border-linie px-4 pb-4 pt-6">
        <ButtonLink variant="quiet" href={`/abmelden/${token}`}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          {LINK_INFOS.zurueck}
        </ButtonLink>
        <div className="flex min-w-0 flex-col">
          <h1 className="type-headline-small text-on-surface">{LINK_INFOS.titel}</h1>
          <p className="type-body-small truncate text-on-surface-mittel">{name}</p>
        </div>
      </header>
      <div className="flex flex-col divide-y divide-linie px-4 py-2">
        {teams.length > 0 &&
          (schnuppert ? (
            <>
              <Abschnitt titel={linkSchnuppernTitel(vorname)}>
                <p>{linkProbeKopf(vorname)}</p>
              </Abschnitt>
              {probeInfo && (
                <Abschnitt titel={PROBE_TEXT.linkInfoTitel}>
                  <p className="whitespace-pre-line break-words">
                    <TextMitLinks text={probeInfo} />
                  </p>
                </Abschnitt>
              )}
            </>
          ) : (
            <>
              <Abschnitt titel={linkMeldenTitel(vorname)}>
                <p>{linkMeldenText(name, vorname)}</p>
              </Abschnitt>
              {/* Gleichnamige Teams eines Vereins sind im Altbestand möglich: Schlüssel mit Stelle. */}
              {teamInfos.map((t, i) => (
                <Abschnitt key={`${i}:${t.team}`} titel={teamInfosLinkTitel(t.team)}>
                  <p className="type-body-small mb-2 text-on-surface-mittel">{teamInfosStand(t.stand)}</p>
                  <GegliederterText text={t.text} titelEbene={4} />
                </Abschnitt>
              ))}
            </>
          ))}
        <Abschnitt titel={LINK_INFOS.angaben}>
          <p>{angabenSehenText(verein, vorname)}</p>
        </Abschnitt>
      </div>
    </>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <Disclosure title={titel} className="py-2">
      <div className="type-body-medium pb-2 text-on-surface">{children}</div>
    </Disclosure>
  );
}
