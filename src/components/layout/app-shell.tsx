"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Menu, MailWarning, Tags, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { FullPageSpinner } from "@/components/common/states";
import { NotificationBell, useOpenNotification } from "./notification-bell";
import { useRealtimeNotifications } from "@/hooks/use-realtime";
import { ACCOUNT_NAV, LINK_NAV, NAV, canShareLinks, type NavItem } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/labels";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Profile, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/config";

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function RoleSwitcher() {
  const { roles, activeRole, setActiveRole } = useAuth();
  const router = useRouter();
  if (roles.length <= 1) return <div className="px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{activeRole ? ROLE_LABEL[activeRole] : ""}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          {activeRole ? ROLE_LABEL[activeRole] : "Chọn vai trò"} <ChevronsUpDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Làm việc với vai trò</DropdownMenuLabel>
        {roles.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => {
              setActiveRole(r);
              router.push(r === "admin" ? "/admin" : "/tong-quan");
            }}
          >
            {ROLE_LABEL[r]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <Link href={role === "admin" ? "/admin" : "/tong-quan"} className="flex items-center gap-2 px-2.5 pt-1 font-semibold" onClick={onNavigate}>
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Tags className="size-4" />
        </span>
        {APP_NAME}
      </Link>
      <RoleSwitcher />
      <div className="flex-1 space-y-4 overflow-y-auto">
        {role && <NavLinks items={NAV[role]} onNavigate={onNavigate} />}
        {canShareLinks(role) && (
          <div className="space-y-1">
            <div className="px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kiếm tiền từ link</div>
            <NavLinks items={LINK_NAV} onNavigate={onNavigate} />
          </div>
        )}
      </div>
      <div className="border-t pt-3">
        <NavLinks items={ACCOUNT_NAV} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function EmailBanner() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/me/profile") });
  const [sending, setSending] = useState(false);
  if (!profile.data || profile.data.emailVerified) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <MailWarning className="size-4" />
      Xác thực email để rút tiền và publish dự án. Kiểm tra hộp thư <b>{profile.data.email}</b>.
      <Button
        size="xs"
        variant="outline"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          try {
            await post("/me/verify-email/resend");
            toast.success("Đã gửi lại email xác thực");
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setSending(false);
          }
        }}
      >
        Gửi lại email
      </Button>
    </div>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/me/profile") });
  const name = profile.data?.displayName ?? me?.name ?? me?.email ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1.5">
          <Avatar className="size-7">
            {profile.data?.avatarUrl && <AvatarImage src={profile.data.avatarUrl} alt="" />}
            <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm md:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{me?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_NAV.map((it) => (
          <DropdownMenuItem key={it.href} asChild>
            <Link href={it.href}>
              <it.icon /> {it.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()} variant="destructive">
          <LogOut /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { status, activeRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const openNotification = useOpenNotification(activeRole);
  useRealtimeNotifications(status === "authed", openNotification);

  useEffect(() => {
    if (status === "anon") {
      const next = window.location.pathname + window.location.search;
      router.replace(`/dang-nhap?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authed") return <FullPageSpinner />;

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar px-3 py-4 lg:block">
        <SidebarBody role={activeRole} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <SidebarBody role={activeRole} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <NotificationBell role={activeRole} />
          <UserMenu />
        </header>
        <EmailBanner />
        <main className={cn("mx-auto w-full flex-1 px-4 py-6 md:px-6", wide ? "max-w-[1600px]" : "max-w-6xl")}>{children}</main>
      </div>
    </div>
  );
}
