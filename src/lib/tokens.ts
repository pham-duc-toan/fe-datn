/**
 * Lưu cặp token ở localStorage để mọi tab dùng chung một phiên (mục 2.3).
 * Refresh token dùng MỘT lần: tab nào làm mới thì ghi cặp mới vào đây, tab khác đọc lại
 * thay vì dùng token cũ (dùng lại token đã xoay = backend thu hồi cả phiên).
 */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  /** Thời điểm access token hết hạn (ms since epoch). */
  expiresAt: number;
};

const KEY = "crowd.tokens";
const CHANNEL = "crowd-auth";

type Listener = (t: TokenPair | null) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      const t = readTokens();
      listeners.forEach((l) => l(t));
    };
  }
  return channel;
}

export function readTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as TokenPair;
    if (!t.accessToken || !t.refreshToken) return null;
    return t;
  } catch {
    return null;
  }
}

export function writeTokens(t: TokenPair | null): void {
  if (typeof window === "undefined") return;
  try {
    if (t) window.localStorage.setItem(KEY, JSON.stringify(t));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* localStorage bị chặn: phiên chỉ sống trong tab này */
  }
  listeners.forEach((l) => l(t));
  getChannel()?.postMessage("changed");
}

export function onTokensChange(l: Listener): () => void {
  getChannel();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function tokenPairFromResponse(r: { accessToken: string; refreshToken: string; expiresIn: number }): TokenPair {
  return { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: Date.now() + r.expiresIn * 1000 };
}

/** Đọc claim của access token (chỉ để hiển thị — backend luôn kiểm lại). */
export function decodeClaims(accessToken: string): Record<string, unknown> {
  try {
    const part = accessToken.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}
