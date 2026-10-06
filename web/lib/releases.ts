import "server-only";
import { unstable_cache } from "next/cache";
import pkg from "@/package.json";
import { TRAININGS_ZEITZONE } from "@/lib/zeit";

/* Die Releases von KiFu, wie sie im öffentlichen Repository veröffentlicht
   sind (#408): Titel und Text kommen unverändert aus den GitHub-Releases, die
   Regeln dafür stehen in docs/releases/.

   Abgerufen wird serverseitig und höchstens einmal pro Stunde — so ist eine
   Änderung auf GitHub spätestens eine Stunde später zu sehen, und das Limit
   der GitHub-API (ohne Token 60 Abrufe pro Stunde und IP) bleibt fern.
   Scheitert ein Abruf, bleibt der zuletzt bekannte Stand stehen; wie alt er
   ist, sagt `abgerufenAm`. Ein `GITHUB_TOKEN` ist freiwillig: Er hebt nur das
   Limit, Rechte braucht er keine, und er verlässt den Server nie. */

/** Die Version, die gerade läuft — dieselbe Quelle wie beim KI-Assistenten. */
export const APP_VERSION: string = pkg.version;

const REPOSITORY = "adbstyle/kifutraining";
/** Eine Stunde: so lange gilt ein Abruf, bevor der nächste ihn ersetzt. */
const GUELTIG_SEKUNDEN = 60 * 60;

export interface Release {
  /** Ohne `v`, z. B. «1.27.0». */
  version: string;
  titel: string;
  /** Markdown, wie veröffentlicht. */
  text: string;
  /** Zeitpunkt der Veröffentlichung, ISO. */
  veroeffentlicht: string;
  url: string;
}

export interface ReleaseStand {
  /** Höchste Version zuerst. */
  releases: Release[];
  /** Wann der Stand von GitHub kam, ISO. */
  abgerufenAm: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  published_at: string | null;
  html_url: string;
}

/** «v1.10.0» → [1, 10, 0]; was keiner Versionsnummer gleicht, → null. */
function versionsteile(version: string): number[] | null {
  const m = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? m.slice(1).map(Number) : null;
}

/** Höhere Version zuerst, also 1.10.0 vor 1.9.0. Ein Release ohne
 *  lesbare Versionsnummer steht hinten, nach Datum. */
export function vergleicheReleases(a: Release, b: Release): number {
  const va = versionsteile(a.version);
  const vb = versionsteile(b.version);
  if (va && vb) {
    for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return vb[i] - va[i];
    return 0;
  }
  if (va || vb) return va ? -1 : 1;
  return b.veroeffentlicht.localeCompare(a.veroeffentlicht);
}

async function holeSeite(seite: number): Promise<GitHubRelease[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ki-fu",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const antwort = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/releases?per_page=100&page=${seite}`,
    // Zwischengespeichert wird mit `unstable_cache` unten, nicht hier. Ein
    // hängender Abruf darf die Seitenleiste nicht aufhalten.
    { headers, cache: "no-store", signal: AbortSignal.timeout(4000) },
  );
  if (!antwort.ok) throw new Error(`GitHub-Releases: HTTP ${antwort.status}`);
  return antwort.json();
}

async function holeReleases(): Promise<ReleaseStand> {
  const roh: GitHubRelease[] = [];
  for (let seite = 1; ; seite++) {
    const teil = await holeSeite(seite);
    roh.push(...teil);
    if (teil.length < 100) break;
  }
  const releases = roh
    .filter((r) => !r.draft && r.published_at)
    .map((r) => ({
      version: r.tag_name.replace(/^v/, ""),
      titel: r.name?.trim() || r.tag_name,
      text: r.body ?? "",
      veroeffentlicht: r.published_at!,
      url: r.html_url,
    }))
    .sort(vergleicheReleases);
  return { releases, abgerufenAm: new Date().toISOString() };
}

// Wirft der Abruf, speichert `unstable_cache` nichts und behält den
// bisherigen Eintrag — das ist der «zuletzt bekannte Stand».
const holeZwischengespeichert = unstable_cache(holeReleases, ["github-releases"], {
  revalidate: GUELTIG_SEKUNDEN,
});

/** Die Releases oder `null`, wenn es noch nie einen Stand gab. */
export async function getReleases(): Promise<ReleaseStand | null> {
  try {
    return await holeZwischengespeichert();
  } catch (fehler) {
    console.error(fehler);
    return null;
  }
}

/**
 * Für die Release-History: der Stand und ob er womöglich nicht aktuell ist.
 *
 * Ein abgelaufener Stand allein heisst noch nicht, dass GitHub fehlt — nach
 * einer ruhigen Stunde ohne Besuch ist er einfach alt, und den neuen holt
 * `unstable_cache` erst im Hintergrund. Darum holt die Seite dann selbst
 * einmal frisch; nur wenn das scheitert, gilt der alte Stand als veraltet.
 */
export async function getReleasesZumLesen(): Promise<{
  stand: ReleaseStand | null;
  veraltet: boolean;
}> {
  const stand = await getReleases();
  const alter = stand ? Date.now() - new Date(stand.abgerufenAm).getTime() : Infinity;
  if (stand && alter <= GUELTIG_SEKUNDEN * 1000) return { stand, veraltet: false };
  try {
    return { stand: await holeReleases(), veraltet: false };
  } catch (fehler) {
    console.error(fehler);
    return { stand, veraltet: !!stand };
  }
}

/** Der späteste Zeitpunkt einer Veröffentlichung — für «schon gesehen?» (#410).
 *  Nicht der Release mit der höchsten Version: Ein nachgeschobener Patch kann
 *  später erscheinen als eine höhere Version. */
export function neuesteVeroeffentlichung(releases: Release[]): string | null {
  return releases.reduce<string | null>(
    (max, r) => (!max || Date.parse(r.veroeffentlicht) > Date.parse(max) ? r.veroeffentlicht : max),
    null,
  );
}

/** «6. Oktober 2026» — als Tag in der Schweiz, auch kurz nach Mitternacht. */
export function datumLang(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: TRAININGS_ZEITZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
