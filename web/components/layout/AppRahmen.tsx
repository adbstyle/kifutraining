"use client";

import { createContext, useContext, useState } from "react";
import { SeitenleistenKnopf, leisteStil } from "@/components/ui";
import { leisteCookie } from "@/lib/seitenleiste";

type SeitenleisteZustand = {
  slim: boolean;
  slimUmschalten: () => void;
  drawerOffen: boolean;
  setzeDrawerOffen: (offen: boolean) => void;
};

const SeitenleisteKontext = createContext<SeitenleisteZustand | null>(null);

/**
 * Rahmen der App: Seitenleiste links, Inhalt rechts (unter `lg` darüber die
 * Kopfzeile). Hält, ob die Leiste schmal ist und ob der Drawer offen steht.
 *
 * Die Breite steht als `--leiste-breite` am Rahmen; Leiste, Snackbar und die
 * Leiste der Durchführung lesen sie von dort. Der Anfangswert kommt aus dem
 * Cookie, das der Server liest — so stimmt sie schon im ersten HTML.
 */
export function AppRahmen({
  anfangsSlim,
  children,
}: {
  anfangsSlim: boolean;
  children: React.ReactNode;
}) {
  const [slim, setSlim] = useState(anfangsSlim);
  const [drawerOffen, setzeDrawerOffen] = useState(false);

  function slimUmschalten() {
    const neu = !slim;
    setSlim(neu);
    document.cookie = leisteCookie(neu);
  }

  return (
    <SeitenleisteKontext.Provider value={{ slim, slimUmschalten, drawerOffen, setzeDrawerOffen }}>
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

/** Der Umschalter vor den Brotkrumen, verbunden mit dem Rahmen. */
export function SlimSchalter() {
  const { slim, slimUmschalten } = useSeitenleiste();
  return <SeitenleistenKnopf slim={slim} onClick={slimUmschalten} />;
}
