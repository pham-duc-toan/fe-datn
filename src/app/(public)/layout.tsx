import Link from "next/link";
import { Tags } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-background">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Tags className="size-4" />
          </span>
          Crowd Label
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:items-center">{children}</main>
    </div>
  );
}
