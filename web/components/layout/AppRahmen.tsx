"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { SeitenleistenKnopf, leisteStil } from "@/components/ui";
import { leisteCookie } from "@/lib/seitenleiste";
import { spalteCookie } from "@/lib/spalte";

type SeitenleisteZustand = {
  slim: boolean;
  slimUmschalten: () => void;
  drawerOffen: boolean;
  setzeDrawerOffen: (offen: boolean) => void;
  /** Die vom Trainer gezogene Breite der zweiten Spalte (`ZweiSpalten`) in
   *  Pixeln, `null` = Vorgabe. Gilt für alle zweispaltigen Seiten. */
  spalte: number | null;
  setzeSpalte: (px: number | null) => void;
};

const SeitenleisteKontext = createContext<SeitenleisteZustand | null>(null);

/**
 * Rahmen der App: Seitenleiste links, Inhalt rechts (unter `lg` darüber die
 * Kopfzeile). Hält, ob die Leiste schmal ist und ob der Drawer offen steht.
 *
 * Die Breite steht als `--leiste-breite` am Rahmen; Leiste, Snackbar und die
 * Leiste der Durchführung lesen sie von dort. Der Anfangswert kommt aus dem
 * Cookie, das der Server liest — so stimmt sie schon im ersten HTML. Ebenso
 * die Breite der zweiten Spalte (`ZweiSpalten`), die der Trainer zieht.
 */
export function AppRahmen({
  anfangsSlim,
  anfangsSpalte,
  children,
}: {
  anfangsSlim: boolean;
  anfangsSpalte: number | null;
  children: React.ReactNode;
}) {
  const [slim, setSlim] = useState(anfangsSlim);
  const [drawerOffen, setzeDrawerOffen] = useState(false);
  const [spalte, setzeSpalteZustand] = useState(anfangsSpalte);
  const setzeSpalte = (px: number | null) => {
    setzeSpalteZustand(px);
    document.cookie = spalteCookie(px);
  };

  // Das Cookie folgt dem Zustand, statt im Klick gesetzt zu werden — so
  // zählt jeder Klick, auch zwei vor dem nächsten Rendern.
  useEffect(() => {
    document.cookie = leisteCookie(slim);
  }, [slim]);
  const slimUmschalten = () => setSlim((s) => !s);

  return (
    <SeitenleisteKontext.Provider
      value={{ slim, slimUmschalten, drawerOffen, setzeDrawerOffen, spalte, setzeSpalte }}
    >
      <div className="flex min-h-dvh flex-col lg:flex-row" style={leisteStil(slim)}>
        {children}
      </div>
    </SeitenleisteKontext.Provider>
  );
}

export function useSeitenleiste(): SeitenleisteZustand {
  const zustand = useContext(SeitenleisteKontext);
  if (!zustand) throw new Error("useSeitenleiste braucht den AppRahmen im (app)-Layout.");
  return zustand;
}

/** Die Inhaltsspalte. Solange der Drawer offen ist, liegt sie unter dem Scrim
 *  und ist `inert` — weder Tastatur noch Screenreader erreichen sie dann. */
export function AppInhalt({ children }: { children: React.ReactNode }) {
  const { drawerOffen } = useSeitenleiste();
  return (
    <div className="min-w-0 flex-1" inert={drawerOffen}>
      {children}
    </div>
  );
}

/** Der Umschalter vor den Brotkrumen, verbunden mit dem Rahmen. */
export function SlimSchalter() {
  const { slim, slimUmschalten } = useSeitenleiste();
  return <SeitenleistenKnopf slim={slim} onClick={slimUmschalten} />;
}
