import type { Metadata } from "next";
import { ExternalLink, Tag } from "lucide-react";
import { Leerzustand, SectionMessage } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { ReleaseText } from "@/components/versionen/ReleaseText";
import { VersionenGesehen } from "@/components/versionen/VersionenGesehen";
import { getReleasesZumLesen, neuesteVeroeffentlichung } from "@/lib/releases";
import { APP_VERSION } from "@/lib/version";
import { datumKurz, kalendertagAmTrainingsort } from "@/lib/zeit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Versionen - KiFu" };

/* Die Release-History (#408): alle veröffentlichten Releases, die höchste
   Version zuerst, je mit Titel und Text wie im Repository. Ohne Anmeldung
   erreichbar und über ihre Adresse teilbar. Ist GitHub nicht erreichbar,
   steht der zuletzt bekannte Stand mit Hinweis; gab es nie einen, nur der
   Hinweis. */
/** Der Tag in der Schweiz, geschrieben wie jedes Datum der Anwendung. */
function tag(iso: string): string {
  return datumKurz(kalendertagAmTrainingsort(new Date(iso)));
}

export default async function VersionenPage() {
  const { stand, veraltet } = await getReleasesZumLesen();
  const neueste = stand && neuesteVeroeffentlichung(stand.releases);

  return (
    <Seitenrahmen breite="3xl" krumen={[{ label: "Versionen" }]}>
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
          <div className="flex flex-col divide-y divide-linie">
            {stand.releases.map((r) => (
              <article
                key={r.version}
                aria-labelledby={`version-${r.version}`}
                className="flex flex-col gap-3 py-6 first:pt-0"
              >
                <header className="flex flex-col gap-1">
                  <h2 id={`version-${r.version}`} className="type-title-large text-on-surface">
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
        </>
      )}
    </Seitenrahmen>
  );
}
