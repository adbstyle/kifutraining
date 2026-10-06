import pkg from "@/package.json";

/** Die Version, die gerade läuft — für Seitenleiste, «Versionen» und den
 *  KI-Assistenten (MCP `serverInfo`) aus derselben Quelle. */
export const APP_VERSION: string = pkg.version;
