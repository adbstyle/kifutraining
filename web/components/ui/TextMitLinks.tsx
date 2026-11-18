import { Fragment } from "react";
import { textMitLinks } from "@/lib/text-links";
import { ExternerLink } from "./ExternerLink";

/** Ein Text, in dem Webadressen zu externen Links werden (#556 AK 5, #598
 *  AK 8) — eine Darstellung für `KuerzbarerText`, `GegliederterText` und das
 *  Info-Schreiben am Link. Alles läuft als React-Text; HTML wird nie
 *  ausgeführt. */
export function TextMitLinks({ text }: { text: string }) {
  return textMitLinks(text).map((t, i) =>
    t.art === "link" ? (
      <ExternerLink key={i} href={t.href}>
        {t.text}
      </ExternerLink>
    ) : (
      <Fragment key={i}>{t.text}</Fragment>
    ),
  );
}
