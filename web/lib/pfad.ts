/**
 * Der angefragte Pfad für Server-Komponenten.
 *
 * Eine Server-Komponente kennt die Adresse nicht — es gibt kein
 * serverseitiges `usePathname`. Die Middleware sieht den Pfad ohnehin und legt
 * ihn unter diesem Namen in den Request-Headern ab; `AppNav` liest ihn dort
 * (#156).
 *
 * Eigene Datei, damit die Navigation nicht das Middleware-Modul samt
 * Supabase-Client in den Komponentenbaum zieht — die Konstante ist alles, was
 * beide Seiten teilen.
 */
export const PFAD_HEADER = "x-pathname";
