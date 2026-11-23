"use server";

import { redirect } from "next/navigation";
import { eigeneBildPfade } from "@/lib/fassung";
import {
  aendereSpielerImVerein,
  benenneTeamUm,
  benenneVereinUm,
  entferneAusTeam,
  entferneAusVerwaltung,
  erneuereSpielerLinkImVerein,
  findePerson,
  gruendeVerein,
  holeSpielerLinkImVerein,
  importiereInVerein,
  ladeSpielerTeamsImVerein,
  legeSpielerImVereinAn,
  legeTeamAn,
  loescheSpielerImVerein,
  loescheVerein,
  loeseTeamAuf,
  nimmInVerwaltungAuf,
  nimmInsTeamAuf,
  nimmMichInsTeam,
  nimmSpielerAusTeamImVerein,
  ordneSpielerZu,
  pruefeVereinImport,
  setzeLinkZugestelltImVerein,
} from "@/lib/kern/verein";
import { oeffentlicherOrigin } from "@/lib/origin";
import { revalidiereAlleTeams, revalidiereMitgliedschaften, revalidiereTeam, revalidiereVerein } from "@/lib/revalidate";
import { raeumeVerwaisteBilder } from "@/lib/storage-aufraeumen";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";
import type { FehlerArt, KernFehler } from "@/lib/kern/ergebnis";
import { spielerLinkUrl, type LinkStand, type SpielerEingabe } from "@/lib/spieler";
import type { ImportAusgang, ImportEintrag, ImportErwartet, ImportVorschau } from "@/lib/spieler-import";
import { vereinHeisstInzwischenText, type PersonSchritt } from "@/lib/verein";

/**
 * Der Spielerbestand des Vereins (Story #579) — dünne Adapter über den
 * Fachkern (lib/kern/verein.ts). Nur die Vereinsverwaltung; die Datenebene
 * prüft die Rolle, die Seite zeigt es nur ihr.
 */

/** Spieler:innen einem Team zuordnen, alle oder keine (#579 AK 2, 20, 21).
 *  `ersetzt`: anstehende Termine, die ihre erwartete Spielerzahl verloren.
 *  `schnuppern`: zum Schnuppern, nur einzeln (#584 AK 8–11). */
export async function ordneSpielerZuAktion(
  teamId: string,
  teamName: string,
  spielerIds: string[],
  schnuppern = false,
): Promise<{ ok: true; anzahl: number; ersetzt: number } | Fehler> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ordneSpielerZu(a.supabase, a.userId, { teamId, teamName, spielerIds, schnuppern });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  return { ok: true, anzahl: r.wert.anzahl, ersetzt: r.wert.ersetzt };
}

// ── Vereinsverwaltung (Story #581) ──────────────────────────────────────────

/** Ergebnis einer Action der Vereinsverwaltung: `error` ist der fertige Satz;
 *  `feld` nennt, wo er hingehört (`name`, `teamname`) — `team_id` bzw.
 *  `verein_id` heisst: das Ziel ist nicht mehr zu finden (Team aufgelöst,
 *  Recht weg), die offene Seite ist überholt. `art` (wo mitgegeben) ist die
 *  Art des Fehlers aus dem Kern: Nur eine `eingabe` gehört an ein Feld, eine
 *  Regel-Abweisung steht über den Feldern. */
type Fehler = { ok: false; error: string; feld?: string; art?: FehlerArt };

const keinKonto: Fehler = { ok: false, error: NICHT_ANGEMELDET };

/** Ein Fehler des Kerns als Schritt der Personenaufnahme. Ist das Ziel nicht
 *  mehr zu finden (Team aufgelöst, Recht weg), sagt `zielWeg` dem Aufrufer,
 *  dass die offene Seite überholt ist. */
function schrittFehler(r: KernFehler): PersonSchritt {
  return r.art === "nicht_gefunden" && (r.feld === "team_id" || r.feld === "verein_id")
    ? { ok: false, meldung: r.meldung, zielWeg: true }
    : { ok: false, meldung: r.meldung };
}

/** Einen Verein gründen (#587): Die Person wird seine erste Verwaltung.
 *  `bestaetigt`: das Häkchen «berechtigt»; `fassung`: die Fassung der
 *  Vereinbarung zur Auftragsbearbeitung, der die Person zustimmt (`null` ohne
 *  Häkchen, #675). Die Datenebene verlangt beides selbst. Gelingt es, leitet die Action selbst in den Bereich «Verein»
 *  um, nach dem Neurendern der Seitenleiste (sie kennt den Verein jetzt) —
 *  eine Weiterleitung im Client träfe noch die Seite ohne Verein. Gehört die
 *  Person inzwischen einem Verein an, meldet `feld: "verein_id"` die überholte
 *  Seite; der Aufrufer lädt sie neu. */
export async function gruendeVereinAktion(name: string, bestaetigt: boolean, fassung: string | null): Promise<Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await gruendeVerein(a.supabase, a.userId, { name, bestaetigt, fassung });
  if (!r.ok) return { ok: false, error: r.meldung, art: r.art, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  redirect("/verein");
}

/** Ein Team anlegen; die Verwaltung wird dabei nicht Trainer:in. */
export async function legeTeamAnAktion(
  vereinId: string,
  name: string,
): Promise<{ ok: true; teamId: string; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await legeTeamAn(a.supabase, a.userId, { vereinId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, teamId: r.wert.teamId, name: r.wert.name };
}

/** Ein Team umbenennen (Verwaltung). */
export async function benenneTeamUmAktion(teamId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await benenneTeamUm(a.supabase, a.userId, { teamId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, name: r.wert.name };
}

/** Den Verein umbenennen. */
export async function benenneVereinUmAktion(vereinId: string, name: string): Promise<{ ok: true; name: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await benenneVereinUm(a.supabase, a.userId, { vereinId, name });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true, name: r.wert.name };
}

/** Ein Team auflösen, nur mit dem bestätigten Namen. Danach räumt die Action
 *  die Bilder aus dem Speicher (die Datenebene liefert die Pfade; mit dem Team
 *  erlischt das Recht daran, darum der Service-Role-Nachlauf). `name_falsch`
 *  nennt den aktuellen Namen (`aktuellerName`).
 *
 *  Gelingt es, leitet die Action selbst nach `/verein` um, mit dem Namen aus
 *  der Antwort der Datenebene für die Meldung. Eine Weiterleitung im Client
 *  liefe gegen die Antwort der Action: `revalidiereMitgliedschaften` rendert
 *  die offene Seite neu, und deren Rahmen leitete selbst um. Mit `redirect`
 *  rendert die Antwort nur das Ziel. */
export async function loeseTeamAufAktion(
  teamId: string,
  teamname: string,
): Promise<Fehler & { aktuellerName?: string }> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await loeseTeamAuf(a.supabase, a.userId, { teamId, teamname });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  if (r.wert.status === "name_falsch") {
    revalidiereTeam(teamId);
    return {
      ok: false,
      error: `Das Team heisst inzwischen «${r.wert.name}». Gib diesen Namen ein, um fortzufahren.`,
      feld: "teamname",
      aktuellerName: r.wert.name,
    };
  }
  // Die Ansichten des aufgelösten Teams nicht revalidieren: es gibt sie nicht
  // mehr.
  revalidiereVerein();
  revalidiereMitgliedschaften();
  await raeumeVerwaisteBilder(eigeneBildPfade(r.wert.bilder));
  redirect(`/verein?aufgeloest=${encodeURIComponent(r.wert.name)}`);
}

/** Den Verein löschen, nur mit dem bestätigten Vereinsnamen (#587 AK 10, 11).
 *  Danach räumt die Action die Bilder aus dem Speicher: Mit dem Verein erlischt
 *  das Recht daran, darum der Service-Role-Nachlauf (gestückelt). `feld:
 *  "vereinsname"` meldet einen Namen, der nicht mehr stimmt, samt dem
 *  aktuellen (`aktuellerName`); die offene Seite lädt dann neu.
 *
 *  Gelingt es, leitet die Action selbst nach `/teams` um, mit dem Namen aus der
 *  Antwort der Datenebene für die Meldung: Die Seite der Verwaltung gibt es
 *  danach nicht mehr, und ihre Neuberechnung in der Antwort leitete sonst
 *  gegen eine Weiterleitung im Client um (wie beim Auflösen eines Teams). */
export async function loescheVereinAktion(
  vereinId: string,
  vereinsname: string,
): Promise<Fehler & { aktuellerName?: string }> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await loescheVerein(a.supabase, a.userId, { vereinId, vereinsname });
  if (!r.ok) return { ok: false, error: r.meldung, art: r.art, feld: r.feld };
  if (r.wert.status === "vereinsname_falsch") {
    revalidiereVerein();
    return {
      ok: false,
      error: vereinHeisstInzwischenText(r.wert.name, "verein"),
      feld: "vereinsname",
      aktuellerName: r.wert.name,
    };
  }
  revalidiereVerein();
  revalidiereMitgliedschaften();
  await raeumeVerwaisteBilder(eigeneBildPfade(r.wert.bilder));
  redirect(`/teams?verein_weg=${encodeURIComponent(r.wert.name)}`);
}

/** Nachsehen, wer hinter der Adresse steckt — mit `teamId` für ein Team, ohne
 *  für die Verwaltung. */
export async function sucheVereinPersonAktion(
  vereinId: string,
  email: string,
  teamId?: string,
): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await findePerson(a.supabase, a.userId, { vereinId, email, teamId });
  return r.ok ? r.wert : schrittFehler(r);
}

/** Eine Person ins Team aufnehmen (Verwaltung). */
export async function nimmInsTeamAufAktion(teamId: string, email: string): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await nimmInsTeamAuf(a.supabase, a.userId, { teamId, email });
  if (!r.ok) return schrittFehler(r);
  if (r.wert.ok) {
    revalidiereTeam(teamId);
    revalidiereVerein();
    revalidiereMitgliedschaften();
  }
  return r.wert;
}

/** Sich selbst ins Team aufnehmen («Mich aufnehmen»). */
export async function nimmMichInsTeamAktion(teamId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await nimmMichInsTeam(a.supabase, a.userId, { teamId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true };
}

/** Eine Trainer:in aus dem Team entfernen — auch sich selbst. */
export async function entferneAusTeamAktion(teamId: string, userId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await entferneAusTeam(a.supabase, a.userId, { teamId, userId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  revalidiereMitgliedschaften();
  return { ok: true };
}

/** Eine Person in die Vereinsverwaltung aufnehmen. */
export async function nimmInVerwaltungAufAktion(vereinId: string, email: string): Promise<PersonSchritt> {
  const a = await angemeldet();
  if (!a) return { ok: false, meldung: NICHT_ANGEMELDET };
  const r = await nimmInVerwaltungAuf(a.supabase, a.userId, { vereinId, email });
  if (!r.ok) return schrittFehler(r);
  if (r.wert.ok) {
    revalidiereVerein();
    revalidiereMitgliedschaften();
  }
  return r.wert;
}

/** Eine Person aus der Verwaltung entfernen, auch sich selbst (austreten).
 *  Die letzte Person geht nicht (Text `LETZTE_VERWALTUNG`, `feld: "user_id"`).
 *  Nach dem eigenen Austritt leitet die Action selbst nach `/teams` um: Die
 *  offene Seite gehört nur der Verwaltung, und ihre Neuberechnung in der
 *  Antwort leitete sonst gegen eine Weiterleitung im Client um. */
export async function entferneAusVerwaltungAktion(vereinId: string, userId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await entferneAusVerwaltung(a.supabase, a.userId, { vereinId, userId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereVerein();
  revalidiereMitgliedschaften();
  if (userId === a.userId) redirect("/teams");
  return { ok: true };
}

/** Eine Spieler:in aus einem Team nehmen; `ohneTeam`: danach in keinem mehr;
 *  `schnuppernBeendet`: Schnuppern und Zählung sind damit beendet (#584). */
export async function nimmSpielerAusTeamImVereinAktion(
  teamId: string,
  spielerId: string,
): Promise<{ ok: true; ohneTeam: boolean; schnuppernBeendet: boolean } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await nimmSpielerAusTeamImVerein(a.supabase, a.userId, { teamId, spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereTeam(teamId);
  revalidiereVerein();
  return { ok: true, ohneTeam: r.wert.ohneTeam, schnuppernBeendet: r.wert.schnuppernBeendet };
}

// ── Spielerbestand der Verwaltung (Story #582) ──────────────────────────────

/** Eine Spieler:in ohne Team erfassen. `vereinName` steht nur im Satz der
 *  Abweisung. Ein neuer Eintrag hängt an keinem Team: nur der Verein lädt neu. */
export async function legeSpielerImVereinAnAktion(
  vereinId: string,
  vereinName: string,
  e: SpielerEingabe,
): Promise<{ ok: true; spielerId: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await legeSpielerImVereinAn(a.supabase, a.userId, { ...e, vereinId, vereinName });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld, art: r.art };
  revalidiereVerein();
  return { ok: true, spielerId: r.wert.spielerId };
}

/** Die Angaben einer Spieler:in ändern. Ihre Teams kennt die Antwort nicht:
 *  Namen stehen in allen Team-Ansichten, darum laden alle neu. */
export async function aendereSpielerImVereinAktion(spielerId: string, e: SpielerEingabe): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await aendereSpielerImVerein(a.supabase, a.userId, { ...e, spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld, art: r.art };
  revalidiereAlleTeams();
  revalidiereVerein();
  return { ok: true };
}

/** Die Teams einer Spieler:in, frisch gelesen für die Bestätigung zum Löschen
 *  und zum Erneuern des Links (#583 AK 16). */
export async function ladeVereinSpielerTeamsAktion(
  spielerId: string,
): Promise<{ ok: true; teams: { id: string; name: string; abholbar: boolean }[] } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await ladeSpielerTeamsImVerein(a.supabase, a.userId, { spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  return { ok: true, teams: r.wert.teams };
}

/** Eine Spieler:in aus dem Verein löschen; die Teams aus der Antwort der
 *  Datenebene laden neu. */
export async function loescheSpielerImVereinAktion(spielerId: string): Promise<{ ok: true } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await loescheSpielerImVerein(a.supabase, a.userId, { spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  for (const t of r.wert.teams) revalidiereTeam(t.id);
  revalidiereVerein();
  return { ok: true };
}

/** Den privaten Link einer Spieler:in holen — als Adresse. `ohneTeam` und
 *  `stand` stammen aus der Datenebene, nicht aus der offenen Liste. */
export async function holeVereinSpielerLinkAktion(
  spielerId: string,
): Promise<{ ok: true; url: string; ohneTeam: boolean; stand: LinkStand } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await holeSpielerLinkImVerein(a.supabase, a.userId, { spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token), ohneTeam: r.wert.ohneTeam, stand: r.wert.stand };
}

/** Den Link als zugestellt markieren oder zurücknehmen (#657 AK 2). Der
 *  Stand gilt auch in den Team-Listen (PC 1), darum laden sie neu.
 *  `geaendert` false: Er war inzwischen abgeholt. */
export async function setzeLinkZugestelltImVereinAktion(
  spielerId: string,
  zugestellt: boolean,
): Promise<{ ok: true; stand: LinkStand; geaendert: boolean } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await setzeLinkZugestelltImVerein(a.supabase, a.userId, { spielerId, zugestellt });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereAlleTeams();
  revalidiereVerein();
  return { ok: true, stand: r.wert.linkStand, geaendert: r.wert.geaendert };
}

/** Den privaten Link erneuern: Der bisherige gilt nie wieder. Der Stand in
 *  den Team-Listen ist wieder offen, darum laden sie neu. */
export async function erneuereVereinSpielerLinkAktion(spielerId: string): Promise<{ ok: true; url: string } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await erneuereSpielerLinkImVerein(a.supabase, a.userId, { spielerId });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  revalidiereAlleTeams();
  revalidiereVerein();
  return { ok: true, url: spielerLinkUrl(await oeffentlicherOrigin(), r.wert.token) };
}

// ── Import aus einer Datei (Story #585) ─────────────────────────────────────

/** Die Vorschau eines Imports in den Spielerbestand des Vereins — nur die vier
 *  Angaben je Zeile kommen hierher, die Datei bleibt im Browser. */
export async function pruefeVereinImportAktion(
  vereinId: string,
  zeilen: ImportEintrag[],
): Promise<{ ok: true; vorschau: ImportVorschau } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await pruefeVereinImport(a.supabase, a.userId, { vereinId, zeilen });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  return { ok: true, vorschau: r.wert };
}

/** Den Import übernehmen, ganz oder gar nicht. `veraltet`: Der Bestand hat die
 *  bestätigte Vorschau überholt, nichts ist übernommen. Neue hängen an keinem
 *  Team (nur der Verein lädt neu); eine geänderte J+S-Nummer steht in jeder
 *  Team-Spielerliste, darum laden dann alle Teams neu. */
export async function importiereInVereinAktion(
  vereinId: string,
  zeilen: ImportEintrag[],
  erwartet: ImportErwartet,
): Promise<{ ok: true; ausgang: ImportAusgang } | Fehler> {
  const a = await angemeldet();
  if (!a) return keinKonto;
  const r = await importiereInVerein(a.supabase, a.userId, { vereinId, zeilen, erwartet });
  if (!r.ok) return { ok: false, error: r.meldung, feld: r.feld };
  if (r.wert.status === "uebernommen") {
    if (r.wert.js > 0) revalidiereAlleTeams();
    revalidiereVerein();
  }
  return { ok: true, ausgang: r.wert };
}
