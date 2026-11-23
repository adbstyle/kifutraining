import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { VORSCHAU_CLAIM, VORSCHAU_NAME } from "@/lib/auffindbar";
import { GRUND_HELL, PRIMARY_HELL, TINTE } from "@/lib/farben";

/* Die Vorschau beim Teilen (#673 AK 3, Entscheid 2): für JEDE Adresse
   dieselbe — Bildmarke, «KiFu» und der Claim, nichts sonst (keine Namen, auch
   nicht von einem privaten Link). Liegt in der Wurzel und gilt damit für alle
   Seiten; keine Seite setzt ein eigenes Bild. Hell wie die Startseite. Wird
   beim Build einmal gerendert. */
export const alt = "KiFu – Mehr Fussball. Weniger Bürokratie.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Vorschaubild() {
  // Dieselbe Bildmarke wie Favicon, Seitenleiste und Kopfzeile der Startseite.
  const marke = await readFile(join(process.cwd(), "app/icon.svg"));
  const markeQuelle = `data:image/svg+xml;base64,${marke.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: GRUND_HELL,
          color: TINTE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse kennt nur <img> */}
          <img src={markeQuelle} width={180} height={180} alt="" />
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -4 }}>{VORSCHAU_NAME}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 56, color: PRIMARY_HELL }}>{VORSCHAU_CLAIM}</div>
      </div>
    ),
    size,
  );
}
