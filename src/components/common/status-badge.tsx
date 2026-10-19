import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

const TONE: Record<Tone, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  info: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ entry, className }: { entry: [string, Tone]; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium whitespace-nowrap", TONE[entry[1]], className)}>
      {entry[0]}
    </span>
  );
}

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}
