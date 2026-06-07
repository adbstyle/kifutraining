import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="focus-ring type-label-medium mb-6 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zum Katalog
      </Link>
      {children}
    </main>
  );
}
