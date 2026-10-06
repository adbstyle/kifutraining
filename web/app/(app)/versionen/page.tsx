import type { Metadata } from "next";
import { ExternalLink, Tag } from "lucide-react";
import { Leerzustand, SectionMessage } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { ReleaseText } from "@/components/versionen/ReleaseText";
import { VersionenGesehen } from "@/components/versionen/VersionenGesehen";
import { VersionenVerzeichnis } from "@/components/versionen/VersionenVerzeichnis";
import { versionAnker } from "@/lib/versionen-anker";
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
   rechts stehen die Texte untereinander; schmal nur die Texte. */
/** Der Tag in der Schweiz, geschrieben wie jedes Datum der Anwendung. */
function tag(iso: string): string {
  return datumKurz(kalendertagAmTrainingsort(new Date(iso)));
}

export default async function VersionenPage() {
  const { stand, veraltet } = await getReleasesZumLesen();
  const neueste = stand && neuesteVeroeffentlichung(stand.releases);

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
          <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
            <VersionenVerzeichnis
              eintraege={stand.releases.map(({ version, titel }) => ({ version, titel }))}
            />
            <div className="flex max-w-3xl flex-col divide-y divide-linie">
              {stand.releases.map((r) => (
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
          </div>
        </>
      )}
    </Seitenrahmen>
  );
}
