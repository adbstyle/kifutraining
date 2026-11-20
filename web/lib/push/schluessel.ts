import "server-only";
import { createECDH, createHash } from "node:crypto";
import { env } from "@/lib/env";

/** Das Kürzel des VAPID-Public-Keys einer Umgebung (#483 PC 5): steht an
 *  jedem Abo, und die Route stellt nur an Abos mit dem Kürzel ihrer eigenen
 *  Umgebung zu — ein Abo aus der Produktivumgebung bekommt aus der
 *  Testumgebung nichts. sha256, base64url, die ersten 16 Zeichen. */
export function pushSchluessel(publicKey: string): string {
  return createHash("sha256").update(publicKey).digest("base64url").slice(0, 16);
}

/** Was Seite und Aktionen brauchen: der öffentliche Schlüssel (für den
 *  Browser) und sein Kürzel; `null`, wenn die Umgebung keine Mitteilungen
 *  hat (dann kein Schalter). */
export function pushOeffentlich(): { publicKey: string; schluessel: string } | null {
  const v = env.vapid();
  return v ? { publicKey: v.publicKey, schluessel: pushSchluessel(v.publicKey) } : null;
}

/** Ob der öffentliche Schlüssel eines Browsers ein gültiger P-256-Punkt ist.
 *  Die Datenebene prüft nur die Form; mit einem ungültigen Punkt liesse sich
 *  nie verschlüsseln, der Auftrag scheiterte fünfmal. */
export function istGueltigerPunkt(p256dh: string): boolean {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    ecdh.computeSecret(Buffer.from(p256dh, "base64url"));
    return true;
  } catch {
    return false;
  }
}
