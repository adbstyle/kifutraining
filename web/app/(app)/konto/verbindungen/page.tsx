import type { Metadata } from "next";
import { Card, Disclosure, KopierFeld, SectionMessage } from "@/components/ui";
import { KontoRahmen } from "../KontoRahmen";
import { KiZugaengeListe } from "../KiZugaengeListe";
import { AbosListe } from "../AbosListe";
import { getMeineZugaenge } from "@/lib/queries/ki-zugaenge";
import { getMeineAbos } from "@/lib/queries/abos";
import { KI_ZUGAENGE_MAX } from "@/lib/mcp/regeln";
import { oeffentlicherOrigin } from "@/lib/origin";
import { MCP_PFAD } from "@/lib/mcp/pfad";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verbindungen im Konto - KiFu", robots: { index: false } };

/* Konto › Verbindungen (#662 AK 3): was von aussen an diesem Konto hängt —
   KI-Assistenten und Kalender-Abos. Jeder Verweis auf sie (OAuth-Zustimmung,
   Abo-Dialog, Meldung an den KI-Client, `wer_bin_ich`) führt hierher (AK 5). */
export default async function KontoVerbindungenPage() {
  const [zugaenge, abos, origin] = await Promise.all([getMeineZugaenge(), getMeineAbos(), oeffentlicherOrigin()]);
  const adresse = `${origin}${MCP_PFAD}`;

  return (
    <KontoRahmen reiter="verbindungen">
      {/* KI-Zugänge (Story #142 AK 5, AK 6). Die Adresse steht hier, weil der
          Trainer sie in seinen KI-Client eintragen muss; ein Geheimnis gibt es
          nicht (NFR 4) — erlaubt wird im Browser. */}
      <Card className="mb-4 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="type-title-large text-on-surface">KI-Zugänge</h2>
          {zugaenge && (
            <span className="type-body-medium shrink-0 text-on-surface-mittel">
              {zugaenge.length} von {KI_ZUGAENGE_MAX}
            </span>
          )}
        </div>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Verbinde einen KI-Assistenten mit deinem Konto. Er sucht dann Übungen und stellt Trainings
          für dich zusammen. Ein Passwort oder Schlüssel brauchst du nicht: Du erlaubst den Zugriff
          im Browser, mit deiner Anmeldung hier.
        </p>
        <KopierFeld label="Adresse für den KI-Assistenten" value={adresse} className="mt-4" />
        {/* Zwei konkrete Wege statt «in seinen Einstellungen»: Der Trainer weiss
            nicht, wo ein Client die Adresse erwartet (Rückmeldung 2026-09-23).
            Jeder Client, der Werkzeuge über MCP einbindet, funktioniert gleich.
            Eingeklappt, weil man sie nur beim ersten Verbinden braucht. */}
        <Disclosure title="So verbindest du Claude Desktop, claude.ai oder Claude Code" className="mt-3">
          <ol className="type-body-medium list-decimal space-y-2 pl-5 text-on-surface-mittel">
            <li>
              <strong className="text-on-surface">Claude Desktop oder claude.ai:</strong>{" "}
              Einstellungen → Connectors → «Custom connector» hinzufügen → Adresse
              eintragen. Der Browser öffnet sich: anmelden, dem Zugang einen Namen
              geben, «Erlauben».
            </li>
            <li>
              <strong className="text-on-surface">Claude Code im Terminal:</strong>{" "}
              <code className="break-all text-on-surface">{`claude mcp add --transport http kifu ${adresse}`}</code>,
              danach in der Sitzung <code className="text-on-surface">/mcp</code> → kifu →
              «Authenticate»; der Rest läuft wie oben im Browser.
            </li>
          </ol>
          <p className="type-body-small mt-3 text-on-surface-mittel">
            Andere Assistenten, die Werkzeuge über MCP einbinden, gehen gleich.
          </p>
        </Disclosure>
        <p className="type-body-small mt-3 text-on-surface-mittel">
          Höchstens {KI_ZUGAENGE_MAX} Zugänge gleichzeitig; jeden kannst du hier einzeln widerrufen.
        </p>
        <div className="mt-4">
          {zugaenge === null ? (
            <SectionMessage appearance="error">
              Deine KI-Zugänge lassen sich gerade nicht anzeigen. Bitte lade die
              Seite später erneut.
            </SectionMessage>
          ) : (
            <KiZugaengeListe zugaenge={zugaenge} />
          )}
        </div>
      </Card>

      {/* Kalender-Abos (Story #330 AK 4, 5, 7). Der Link ist ein Geheimnis; er
          erscheint nur im Dialog «Link anzeigen», mit seiner Warnung. */}
      <Card className="p-6">
        <h2 className="type-title-large text-on-surface">Kalender-Abos</h2>
        <p className="type-body-medium mt-2 text-on-surface-mittel">
          Deine persönlichen Links, mit denen dein Kalenderprogramm die Trainings und Spiele deiner
          Teams abonniert. Einen neuen holst du im Trainingsplan des Teams.
        </p>
        <div className="mt-4">
          {abos === null ? (
            <SectionMessage appearance="error">Deine Abos liessen sich gerade nicht laden.</SectionMessage>
          ) : (
            <AbosListe abos={abos} />
          )}
        </div>
      </Card>
    </KontoRahmen>
  );
}
