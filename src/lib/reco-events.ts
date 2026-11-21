"use client";

import { api } from "@/lib/api";
import { readTokens } from "@/lib/tokens";
import type { RecoEventKind } from "@/lib/types";

/**
 * Hàng đợi lượt hiện / mở thẻ / "Không quan tâm" gửi cho bộ gợi ý (POST /reco/events, kiến trúc 3.40).
 *
 * - Lưu trong localStorage KÈM thời điểm xảy ra và mã sự kiện (UUID): tắt tab, tải lại trang không mất; mở lại trang thì
 *   gửi nốt. Server bỏ trùng theo mã nên gửi lại lô cũ (hai tab cùng gửi, mạng chập chờn) không bị đếm đôi.
 * - Gửi THEO LÔ mỗi 1 phút (tối đa 100 lượt / request), khi đủ 100 lượt, và khi rời trang (fetch keepalive).
 *   Server chỉ đẩy lô vào hàng đợi (Redis Stream) rồi trả ngay — ghi ClickHouse / cộng sở thích làm bất đồng bộ.
 * - Trước khi xếp lượt lướt MỚI (làm mới feed) gửi hết hàng đợi để bộ gợi ý biết dự án vừa lướt qua.
 * - "Không quan tâm" gửi NGAY (trang sau phải biết để ẩn).
 * Hàng đợi tách theo người dùng (khoá theo mã tài khoản trong token) — đăng xuất / đổi tài khoản không gửi nhầm người.
 * Gửi lỗi thì giữ lại, lần sau gửi tiếp; lượt quá 23 giờ thì bỏ (chỉ là tín hiệu sở thích).
 */
type Muc = {
  eventId: string;
  at: string;
  kind: RecoEventKind;
  projectId: string;
  position: number;
  requestId: string | null;
  sessionId: string | null;
};

const TIEN_TO_KHOA = "crowd.reco.events.v1:";
const CHU_KY_MS = 60_000;
const TOI_DA_LO = 100;
const TOI_DA_LUU = 2000;
const QUA_HAN_MS = 23 * 3600_000;

let dangGui: Promise<void> | null = null;
const daHien = new Set<string>();

/** Mã tài khoản (claim sub của access token) — mỗi người một hàng đợi. */
function maNguoi(): string | null {
  const t = readTokens();
  if (!t) return null;
  try {
    const phan = t.accessToken.split(".")[1];
    const json = JSON.parse(atob(phan.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
    return json.sub ?? null;
  } catch {
    return null;
  }
}

function khoa(): string | null {
  const u = maNguoi();
  return u ? TIEN_TO_KHOA + u : null;
}

function doc(k: string): Muc[] {
  try {
    const raw = window.localStorage.getItem(k);
    const ds = raw ? (JSON.parse(raw) as Muc[]) : [];
    const moc = Date.now() - QUA_HAN_MS;
    return Array.isArray(ds) ? ds.filter((m) => Date.parse(m.at) >= moc) : [];
  } catch {
    return [];
  }
}

function ghi(k: string, ds: Muc[]) {
  try {
    if (ds.length === 0) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify(ds.slice(-TOI_DA_LUU)));
  } catch {
    // localStorage bị chặn / đầy: bỏ qua — đây chỉ là tín hiệu sở thích.
  }
}

/** Gửi hết hàng đợi (theo lô 100). Lỗi thì giữ lại cho lần sau. Gọi chồng nhau thì chờ lần đang gửi. */
export function guiNgay(keepalive = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (dangGui) return dangGui;
  dangGui = (async () => {
    const k = khoa();
    if (!k) return;
    for (let vong = 0; vong < 20; vong++) {
      const lo = doc(k).slice(0, TOI_DA_LO);
      if (lo.length === 0) return;
      try {
        await api("/reco/events", { method: "POST", body: { events: lo }, keepalive });
      } catch {
        return;
      }
      // Đọc lại: trong lúc gửi có thể đã thêm lượt mới.
      const daGui = new Set(lo.map((m) => m.eventId));
      ghi(k, doc(k).filter((m) => !daGui.has(m.eventId)));
    }
  })().finally(() => {
    dangGui = null;
  });
  return dangGui;
}

function them(m: Omit<Muc, "eventId" | "at">) {
  const k = khoa();
  if (!k) return;
  const ds = doc(k);
  ds.push({ ...m, eventId: crypto.randomUUID(), at: new Date().toISOString() });
  ghi(k, ds);
  if (ds.length >= TOI_DA_LO) void guiNgay();
}

/** Thẻ thật sự hiện trên màn (IntersectionObserver ≥ 60 %). Một dự án chỉ ghi một lần mỗi phiên lướt. */
export function ghiHienThe(projectId: string, position: number, requestId: string, sessionId: string) {
  const k = sessionId + ":" + projectId;
  if (daHien.has(k)) return;
  daHien.add(k);
  them({ kind: "impression", projectId, position, requestId, sessionId });
}

export function ghiMoThe(projectId: string, position: number, requestId: string | null, sessionId: string | null) {
  them({ kind: "open", projectId, position, requestId, sessionId });
}

/** "Không quan tâm" gửi NGAY cùng hàng đợi (dự án biến khỏi trang sau). */
export async function khongQuanTam(projectId: string, position: number, requestId: string | null, sessionId: string | null) {
  them({ kind: "not_interested", projectId, position, requestId, sessionId });
  await guiNgay();
}

if (typeof window !== "undefined") {
  window.setInterval(() => void guiNgay(), CHU_KY_MS);
  // Lô còn sót từ lần trước (tắt tab đột ngột).
  window.setTimeout(() => void guiNgay(), 5_000);
  window.addEventListener("pagehide", () => void guiNgay(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void guiNgay(true);
  });
}
