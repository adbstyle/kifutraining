import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

/* Der Text eines Releases, wie er im Repository veröffentlicht ist (#408).

   Die Release-Texte sind Markdown; KiFu zeigt sie mit ihrer Gliederung und
   ihren Hervorhebungen, in der Schrift der Anwendung. Ausgeführt wird darin
   nichts: Eingebettetes HTML fällt weg (`skipHtml`), Links mit gefährlichem
   Ziel entschärft react-markdown von sich aus, Bilder zeigt die Liste nicht
   — sie kämen von fremden Servern. Überschriften im Text rücken eine Stufe
   unter den Titel des Releases. Ein einfacher Zeilenumbruch bricht die Zeile
   wie auf GitHub (`remark-breaks`). Gerendert wird auf dem Server; ins
   Browser-Bundle kommt davon nichts. */
const bausteine: Components = {
  h1: ({ children }) => <h3 className="type-title-medium mt-2 text-on-surface">{children}</h3>,
  h2: ({ children }) => <h3 className="type-title-medium mt-2 text-on-surface">{children}</h3>,
  h3: ({ children }) => <h3 className="type-title-medium mt-2 text-on-surface">{children}</h3>,
  h4: ({ children }) => <h4 className="type-title-small mt-1 text-on-surface">{children}</h4>,
  h5: ({ children }) => <h4 className="type-title-small mt-1 text-on-surface">{children}</h4>,
  h6: ({ children }) => <h4 className="type-title-small mt-1 text-on-surface">{children}</h4>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} className="list-decimal space-y-1 pl-5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="[&>ul]:mt-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-klein bg-elev-08 px-1 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-flaeche bg-elev-08 p-3 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-linie" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-linie pl-3 text-on-surface-mittel">{children}</blockquote>
  ),
};

export function ReleaseText({ text }: { text: string }) {
  return (
    <div className="type-body-medium flex flex-col gap-3 text-on-surface">
      <Markdown components={bausteine} remarkPlugins={[remarkBreaks]} skipHtml disallowedElements={["img"]}>
        {text}
      </Markdown>
    </div>
  );
}
