// Die Quelle des Service Workers der privaten Links (#483), ausgeliefert von
// app/(privat)/abmelden/sw.js/route.ts. Als Text, damit check:kern sie prüfen
// kann (nur `push` und `notificationclick`, kein `fetch`, kein Cache). REIN.
export const SERVICE_WORKER_QUELLE = `"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = null;
  try { d = e.data ? e.data.json() : null; } catch (_) { d = null; }
  if (!d || typeof d.titel !== "string") return;
  e.waitUntil(self.registration.showNotification(d.titel, {
    body: typeof d.text === "string" ? d.text : "",
    tag: typeof d.tag === "string" ? d.tag : undefined,
    lang: "de-CH",
    icon: "/icons/app-192.png",
    data: { url: typeof d.url === "string" ? d.url : null },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const bereich = self.registration.scope;
  let ziel = bereich;
  try {
    const u = new URL(e.notification.data && e.notification.data.url, self.location.origin);
    if (u.origin === self.location.origin && (u.href === bereich || u.href.startsWith(bereich + "?") || u.href.startsWith(bereich + "/"))) ziel = u.href;
  } catch (_) { ziel = bereich; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
    for (const f of fenster) {
      if (f.url.startsWith(bereich) && "navigate" in f) return f.navigate(ziel).then((g) => (g || f).focus());
    }
    return self.clients.openWindow(ziel);
  }));
});
`;
