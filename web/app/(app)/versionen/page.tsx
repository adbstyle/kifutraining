import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ExternalLink, Tag } from "lucide-react";
import { ButtonLink, Leerzustand, SectionMessage } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { ReleaseText } from "@/components/versionen/ReleaseText";
import { VersionenGesehen } from "@/components/versionen/VersionenGesehen";
import { VersionenFlaeche } from "@/components/versionen/VersionenFlaeche";
import { VersionenVerzeichnis } from "@/components/versionen/VersionenVerzeichnis";
import { versionAnker } from "@/lib/versionen-anker";
import { VERZEICHNIS_COOKIE, leseVerzeichnis } from "@/lib/verzeichnis";
import { getReleasesZumLesen, neuesteVeroeffentlichung } from "@/lib/releases";
import { APP_VERSION } from "@/lib/version";
import { datumKurz, kalendertagAmTrainingsort } from "@/lib/zeit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Versionen - KiFu" };

/* Die Release-History (#408): alle veröffentlichten Releases, die höchste
   Version zuerst, je mit Titel und Text wie im Repository. Ohne Anmeldung
   erreichbar und über ihre Adresse teilbar. Ist GitHub nicht erreichbar,
   steht der zuletzt bekannte Stand mit Hinweis; gab es nie einen, nur der
   Hinweis.

   Ab `lg` steht links ein Verzeichnis mit Nummer und Thema jeder Version,
   rechts stehen die Texte untereinander, dazwischen ein Griff, mit dem sich
   die Breite des Verzeichnisses ziehen lässt; schmal nur die Texte.

   Die Texte der neuesten `ZUERST` Versionen stehen gleich da, die älteren erst
   mit `?alle=1` — sonst wüchse die Seite mit jedem Release. Das Verzeichnis
   nennt immer alle; eine ältere führt auf `?alle=1` samt Sprungmarke. */
const ZUERST = 30;
/** Der Tag in der Schweiz, geschrieben wie jedes Datum der Anwendung. */
function tag(iso: string): string {
  return datumKurz(kalendertagAmTrainingsort(new Date(iso)));
}

export default async function VersionenPage({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string }>;
}) {
  const [{ stand, veraltet }, jar, { alle }] = await Promise.all([
    getReleasesZumLesen(),
    cookies(),
    searchParams,
  ]);
  const gezeigt = alle === "1" ? stand?.releases : stand?.releases.slice(0, ZUERST);
  const weitere = (stand?.releases.length ?? 0) - (gezeigt?.length ?? 0);
  // Gesehen ist, was die Seite zeigt (#410) — die neuesten stehen immer da.
  const neueste = gezeigt && neuesteVeroeffentlichung(gezeigt);

  return (
    <Seitenrahmen breite="6xl" krumen={[{ label: "Versionen" }]}>
      <h1 className="sr-only">Versionen</h1>
      <p className="type-body-medium mb-6 text-on-surface-mittel">
        Hier läuft KiFu {APP_VERSION}. Was jede Version gebracht hat, steht darunter.
      </p>

      {!stand ? (
        <Leerzustand icon={Tag} titel="Die Versionen sind gerade nicht abrufbar">
          Versuch es später nochmals.
        </Leerzustand>
      ) : (
        <>
          {neueste && <VersionenGesehen neueste={neueste} />}
          {veraltet && (
            <SectionMessage className="mb-6">
              Die Versionen sind gerade nicht abrufbar. Das hier ist der Stand vom{" "}
              {tag(stand.abgerufenAm)} und womöglich nicht aktuell.
            </SectionMessage>
          )}
          <VersionenFlaeche
            anfangsBreite={leseVerzeichnis(jar.get(VERZEICHNIS_COOKIE)?.value)}
            verzeichnis={
              <VersionenVerzeichnis
                eintraege={stand.releases.map(({ version, titel }, i) => ({
                  version,
                  titel,
                  href: i < (gezeigt?.length ?? 0) ? undefined : `?alle=1#${versionAnker(version)}`,
                }))}
              />
            }
          >
            <div className="flex flex-col divide-y divide-linie">
              {gezeigt?.map((r) => (
                <article
                  key={r.version}
                  id={versionAnker(r.version)}
                  data-version={r.version}
                  aria-labelledby={`${versionAnker(r.version)}-titel`}
                  // Ein Sprung hält ab lg global 6rem Abstand zur klebenden
                  // Kopfzeile (globals.css). Hier rückt er so weit höher, dass
                  // der Titel direkt darunter steht — ohne Rest des vorigen
                  // Texts: 2rem plus die Polsterung oben (1.5rem), die das
                  // erste Release nicht hat.
                  className="flex flex-col gap-3 py-6 first:pt-0 lg:scroll-mt-[-3.5rem] lg:first:scroll-mt-[-2rem]"
                >
                  <header className="flex flex-col gap-1">
                    <h2 id={`${versionAnker(r.version)}-titel`} className="type-title-large text-on-surface">
                      {r.titel}
                    </h2>
                    <p className="type-body-small flex flex-wrap items-center gap-x-2 text-on-surface-mittel">
                      <span>Version {r.version}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={r.veroeffentlicht}>{tag(r.veroeffentlicht)}</time>
                      <span aria-hidden>·</span>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                      >
                        Auf GitHub ansehen
                        <ExternalLink size={12} aria-hidden />
                      </a>
                    </p>
                  </header>
                  {r.text.trim() && <ReleaseText text={r.text} />}
                </article>
              ))}
            </div>
            {weitere > 0 && (
              // Ohne Sprung nach oben: Wer unten «anzeigen» wählt, liest dort weiter.
              <ButtonLink href="?alle=1" scroll={false} variant="outlined" className="mt-6">
                {weitere === 1 ? "Ältere Version anzeigen" : `${weitere} ältere Versionen anzeigen`}
              </ButtonLink>
            )}
          </VersionenFlaeche>
        </>
      )}
    </Seitenrahmen>
  );
}
