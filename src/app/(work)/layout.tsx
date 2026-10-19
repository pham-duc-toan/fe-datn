import { AppShell } from "@/components/layout/app-shell";

/** Workspace làm bài / bài test cần khung rộng. */
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <AppShell wide>{children}</AppShell>;
}
