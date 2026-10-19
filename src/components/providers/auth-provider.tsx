"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, onSessionEnded, refreshTokens } from "@/lib/api";
import { decodeClaims, onTokensChange, readTokens, tokenPairFromResponse, writeTokens } from "@/lib/tokens";
import type { Me, Role, TokenResponse, TwoFactorChallenge } from "@/lib/types";
import { messageForCode } from "@/lib/errors";

type Status = "loading" | "anon" | "authed";

type AuthContextValue = {
  status: Status;
  me: Me | null;
  roles: Role[];
  activeRole: Role | null;
  setActiveRole: (r: Role) => void;
  claims: Record<string, unknown>;
  /** Đăng nhập; tài khoản bật 2FA trả về thử thách thay vì token (mục 17.1). */
  login: (email: string, password: string) => Promise<TwoFactorChallenge | null>;
  verifyTwoFactor: (challengeToken: string, code: string | null, recoveryCode: string | null) => Promise<void>;
  applyTokens: (t: TokenResponse) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  /** Làm mới token để lấy claim mới (email_verified, kyb_verified, identity_verified — mục 2.3). */
  forceRefresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ROLE_KEY = "crowd.activeRole";
const ROLE_PRIORITY: Role[] = ["admin", "business", "labeler", "sharer"];

/** Vai trò làm việc: bỏ "sharer" cũ (chia sẻ link nay là chức năng chung), trừ khi tài khoản chỉ có mỗi nó. */
function workRoles(roles: Role[]): Role[] {
  const r = roles.filter((x) => x !== "sharer");
  return r.length > 0 ? r : roles;
}

function pickRole(roles: Role[]): Role | null {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(ROLE_KEY);
  } catch {
    saved = null;
  }
  if (saved && roles.includes(saved as Role)) return saved as Role;
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [activeRole, setActiveRoleState] = useState<Role | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const t = readTokens();
    if (!t) {
      setMe(null);
      setStatus("anon");
      return;
    }
    try {
      const m = await api<Me>("/me");
      setMe(m);
      setActiveRoleState(pickRole(workRoles(m.roles)));
      setAccessToken(readTokens()?.accessToken ?? null);
      setStatus("authed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        writeTokens(null);
        setMe(null);
        setStatus("anon");
      } else {
        // Backend tạm lỗi: vẫn coi là đã đăng nhập để không đá người dùng ra.
        setStatus(readTokens() ? "authed" : "anon");
      }
    }
  }, []);

  useEffect(() => {
    // Đồng bộ một lần từ hệ ngoài (localStorage + /me) khi mount — đúng mục đích của effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    const offTokens = onTokensChange((t) => {
      setAccessToken(t?.accessToken ?? null);
      if (!t) {
        setMe(null);
        setStatus("anon");
        qc.clear();
      }
    });
    const offEnded = onSessionEnded((reason) => {
      setMe(null);
      setStatus("anon");
      qc.clear();
      toast.error(messageForCode(reason) ?? "Phiên đăng nhập đã kết thúc.");
      router.replace("/dang-nhap");
    });
    return () => {
      offTokens();
      offEnded();
    };
  }, [qc, router]);

  const applyTokens = useCallback(
    async (t: TokenResponse) => {
      writeTokens(tokenPairFromResponse(t));
      qc.clear();
      await loadMe();
    },
    [loadMe, qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api<TokenResponse | TwoFactorChallenge>("/auth/login", { method: "POST", body: { email, password }, auth: false });
      if ("twoFactorRequired" in r && r.twoFactorRequired) return r;
      await applyTokens(r as TokenResponse);
      return null;
    },
    [applyTokens],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string | null, recoveryCode: string | null) => {
      const r = await api<TokenResponse>("/auth/2fa/verify", {
        method: "POST",
        auth: false,
        body: { challengeToken, code: code || undefined, recoveryCode: recoveryCode || undefined },
      });
      await applyTokens(r);
    },
    [applyTokens],
  );

  const logout = useCallback(async () => {
    const t = readTokens();
    if (t) {
      try {
        await api("/auth/logout", { method: "POST", body: { refreshToken: t.refreshToken }, auth: false });
      } catch {
        /* luôn 204 — bỏ qua lỗi mạng */
      }
    }
    writeTokens(null);
    qc.clear();
    setMe(null);
    setStatus("anon");
    router.replace("/dang-nhap");
  }, [qc, router]);

  const forceRefresh = useCallback(async () => {
    await refreshTokens();
    setAccessToken(readTokens()?.accessToken ?? null);
    await loadMe();
  }, [loadMe]);

  const setActiveRole = useCallback((r: Role) => {
    try {
      window.localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* bỏ qua */
    }
    setActiveRoleState(r);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      roles: workRoles(me?.roles ?? []),
      activeRole,
      setActiveRole,
      claims: accessToken ? decodeClaims(accessToken) : {},
      login,
      verifyTwoFactor,
      applyTokens,
      logout,
      reload: loadMe,
      forceRefresh,
    }),
    [status, me, activeRole, setActiveRole, accessToken, login, verifyTwoFactor, applyTokens, logout, loadMe, forceRefresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth phải nằm trong AuthProvider");
  return v;
}
