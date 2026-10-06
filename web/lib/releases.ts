import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";

/* Die Releases von KiFu, wie sie im öffentlichen Repository veröffentlicht
   sind (#408): Titel und Text kommen unverändert aus den GitHub-Releases, die
   Regeln dafür stehen in docs/releases/.

   Abgerufen wird serverseitig, je API-Seite (100 Releases) ein eigener
   Eintrag im Zwischenspeicher — so bleibt jeder Eintrag klein, auch wenn die
   Liste über die Jahre wächst. Ein Eintrag gilt 30 Minuten; ein abgelaufener
   wird beim nächsten Aufruf noch einmal gezeigt und im Hintergrund erneuert.
   So ist eine Änderung auf GitHub spätestens nach einer Stunde zu sehen, und
   das Limit der GitHub-API (ohne Token 60 Abrufe pro Stunde und IP) bleibt
   fern. Scheitert ein Abruf, bleibt der zuletzt bekannte Stand stehen; wie
   alt er ist, sagt `abgerufenAm`. Ein `GITHUB_TOKEN` ist freiwillig: Er hebt
   nur das Limit, Rechte braucht er keine, und er verlässt den Server nie. */

const REPOSITORY = "adbstyle/kifutraining";
const PRO_SEITE = 100;
/** So lange gilt ein Abruf. Die halbe der versprochenen Stunde, weil der
 *  erste Aufruf danach den alten Stand noch zeigt (`unstable_cache` erneuert
 *  im Hintergrund). */
const GUELTIG_SEKUNDEN = 30 * 60;
/** Nach einem gescheiterten Abruf fragt dieser Server-Prozess GitHub so lange
 *  nicht mehr — sonst wartete ohne Stand jede Seite auf das Zeitlimit. Der
 *  Zwischenspeicher wird trotzdem gelesen: Was ein anderer Prozess geholt
 *  hat, erscheint. */
const PAUSE_NACH_FEHLER_MS = 5 * 60 * 1000;

export interface Release {
  /** Ohne `v`, z. B. «1.27.0». */
  version: string;
  /** Das Thema des Releases, ohne vorangestellten Namen und Nummer. */
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
  /** Wann der älteste Teil des Stands von GitHub kam, ISO. */
  abgerufenAm: string;
}

interface Seite {
  releases: Release[];
  /** Kam die Seite voll zurück, gibt es womöglich eine weitere. */
  voll: boolean;
  abgerufenAm: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
}

let pauseBis = 0;

/** «kifutraining 1.27.0 — Platz und Spielerzahl» → «Platz und Spielerzahl».
 *  Name und Nummer stehen in der Metazeile darunter; im Titel wären sie
 *  doppelt. Erfasst die alten Schreibweisen («kifutraining X.Y.Z — »,
 *  «vX.Y.Z - ») und die heutige («KiFu X.Y.Z - »). Bleibt nichts übrig, gilt
 *  der ganze Titel. */
function thema(titel: string, tag: string): string {
  const nummer = tag.replace(/^v/, "").replace(/\./g, "\\.");
  const vorspann = new RegExp(`^(?:kifutraining|kifu)?\\s*v?${nummer}\\s*[-–—:]\\s*`, "i");
  return titel.replace(vorspann, "").trim() || titel;
}

/** Eine API-Seite, abgebildet auf das, was KiFu davon braucht. */
async function holeSeite(seite: number): Promise<Seite> {
  if (Date.now() < pauseBis) throw new Error("GitHub-Releases: Pause nach Fehlschlag");
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ki-fu",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const antwort = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/releases?per_page=${PRO_SEITE}&page=${seite}`,
      // Zwischengespeichert wird mit `unstable_cache` unten, nicht hier. Ein
      // hängender Abruf darf die Seitenleiste nicht aufhalten.
      { headers, cache: "no-store", signal: AbortSignal.timeout(4000) },
    );
    if (!antwort.ok) throw new Error(`GitHub-Releases: HTTP ${antwort.status}`);
    const roh: GitHubRelease[] = await antwort.json();
    return {
      releases: roh
        .filter((r) => !r.draft && !r.prerelease && r.published_at)
        .map((r) => ({
          version: r.tag_name.replace(/^v/, ""),
          titel: thema(r.name?.trim() || r.tag_name, r.tag_name),
          text: r.body ?? "",
          veroeffentlicht: r.published_at!,
          url: r.html_url,
        })),
      voll: roh.length === PRO_SEITE,
      abgerufenAm: new Date().toISOString(),
    };
  } catch (fehler) {
    pauseBis = Date.now() + PAUSE_NACH_FEHLER_MS;
    throw fehler;
  }
}

// Wirft der Abruf, speichert `unstable_cache` nichts und behält den
// bisherigen Eintrag — das ist der «zuletzt bekannte Stand». Die Seitenzahl
// gehört zum Schlüssel.
const holeSeiteZwischengespeichert = unstable_cache(holeSeite, ["github-releases-seite"], {
  revalidate: GUELTIG_SEKUNDEN,
});

/** «v1.10.0» → [1, 10, 0]; was keiner Versionsnummer gleicht, → null. */
function versionsteile(version: string): number[] | null {
  const m = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? m.slice(1).map(Number) : null;
}

/** Höhere Version zuerst, also 1.10.0 vor 1.9.0. Ein Release ohne
 *  lesbare Versionsnummer steht hinten, nach Datum. */
function vergleicheReleases(a: Release, b: Release): number {
  const va = versionsteile(a.version);
  const vb = versionsteile(b.version);
  if (va && vb) {
    for (let i = 0; i < 3; i++) if (va[i] !== vb[i]) return vb[i] - va[i];
    return 0;
  }
  if (va || vb) return va ? -1 : 1;
  return b.veroeffentlicht.localeCompare(a.veroeffentlicht);
}

/** Alle Seiten zusammen. Rückt ein neuer Release ein, kann ein Release kurz
 *  auf zwei Seiten stehen (doppelt nur einmal gezählt) oder bis zur nächsten
 *  Erneuerung der hinteren Seite fehlen. */
async function holeStand(holen: (seite: number) => Promise<Seite>): Promise<ReleaseStand> {
  const seiten: Seite[] = [];
  for (let n = 1; ; n++) {
    const seite = await holen(n);
    seiten.push(seite);
    if (!seite.voll) break;
  }
  const nachVersion = new Map(seiten.flatMap((s) => s.releases).map((r) => [r.version, r]));
  return {
    releases: [...nachVersion.values()].sort(vergleicheReleases),
    abgerufenAm: seiten.map((s) => s.abgerufenAm).sort()[0],
  };
}

/** Die Releases oder `null`, wenn es keinen Stand gibt. Pro Request nur
 *  einmal gelesen, auch wenn Layout und Seite fragen. */
export const getReleases = cache(async (): Promise<ReleaseStand | null> => {
  try {
    return await holeStand(holeSeiteZwischengespeichert);
  } catch (fehler) {
    console.error(fehler);
    return null;
  }
});

/** Der späteste Zeitpunkt einer Veröffentlichung — für «schon gesehen?» (#410).
 *  Nicht der Release mit der höchsten Version: Ein nachgeschobener Patch kann
 *  später erscheinen als eine höhere Version. Er steht immer auf der ersten
 *  Seite, die neuesten Releases liefert GitHub zuerst; die übrigen Seiten
 *  braucht es dafür nicht. */
export const getNeuesteVeroeffentlichung = cache(async (): Promise<string | null> => {
  try {
    return neuesteVeroeffentlichung((await holeSeiteZwischengespeichert(1)).releases);
  } catch {
    return null;
  }
});

export function neuesteVeroeffentlichung(releases: Release[]): string | null {
  return releases.reduce<string | null>(
    (max, r) => (!max || Date.parse(r.veroeffentlicht) > Date.parse(max) ? r.veroeffentlicht : max),
    null,
  );
}

/**
 * Für die Release-History: der Stand und ob er womöglich nicht aktuell ist.
 *
 * Ein abgelaufener Stand allein heisst noch nicht, dass GitHub fehlt — nach
 * einer ruhigen halben Stunde ohne Besuch ist er einfach alt, und den neuen
 * holt `unstable_cache` erst im Hintergrund. Darum holt die Seite dann selbst
 * einmal frisch; nur wenn das scheitert (oder pausiert), gilt der alte Stand
 * als veraltet.
 */
export async function getReleasesZumLesen(): Promise<{
  stand: ReleaseStand | null;
  veraltet: boolean;
}> {
  const stand = await getReleases();
  if (!stand) return { stand, veraltet: false };
  if (Date.now() - Date.parse(stand.abgerufenAm) <= GUELTIG_SEKUNDEN * 1000) {
    return { stand, veraltet: false };
  }
  try {
    return { stand: await holeStand(holeSeite), veraltet: false };
  } catch (fehler) {
    console.error(fehler);
    return { stand, veraltet: true };
  }
}
