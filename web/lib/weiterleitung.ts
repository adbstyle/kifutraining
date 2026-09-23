// Sichere Rücksprung-Ziele nach der Anmeldung.
//
// Der Login trägt sein Ziel im Parameter `redirect`, die Auth-Callbacks in
// `next`. Bisher genügte `startsWith("/")` — das lässt `//evil.example` durch,
// und Browser machen aus `/\evil` und `/<TAB>/evil` ebenfalls ein `//evil`.
// Mit dem Erlauben-Ablauf für KI-Clients (#142) wird der Weg über den Login
// öffentlich beworben; darum hier die eine, geprüfte Regel für alle Stellen.
//
// REIN: ohne Server-Importe, damit `check:ki-zugang` sie prüfen kann.

/** Nur relative Pfade dieser Anwendung; alles andere fällt auf `rueckfall`. */
export function sichererRuecksprung(roh: unknown, rueckfall = "/"): string {
  const v = typeof roh === "string" ? roh : "";
  if (!v.startsWith("/") || v.startsWith("//")) return rueckfall;
  // Steuerzeichen und Backslash: Browser normalisieren sie zu Trennzeichen.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return rueckfall;
  return v;
}
