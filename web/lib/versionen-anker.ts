/** Die Sprungmarke einer Version auf «Versionen», z. B. `version-1.27.0` —
 *  geteilt von Seite (Server) und Verzeichnis (Browser). */
export function versionAnker(version: string): string {
  return `version-${version}`;
}
