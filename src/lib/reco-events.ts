"use client";

import { api } from "@/lib/api";
import type { RecoEventKind } from "@/lib/types";

/**
 * Hàng đợi lượt hiện / mở thẻ / "Không quan tâm" gửi cho bộ gợi ý (POST /reco/events, kiến trúc 3.39).
 * Gửi THEO LÔ: đủ 20 lượt hoặc sau 3 giây, và khi rời trang — không gửi mỗi lượt một request.
 * "Hiện thẻ" chỉ ghi LẦN ĐẦU mỗi dự án trong một phiên lướt (giảm dữ liệu ~3 lần, mục 5.5 kế hoạch).
 * Gửi lỗi thì bỏ qua: đây chỉ là tín hiệu sở thích, không được làm hỏng trang chợ.
 */
type Muc = { kind: RecoEventKind; projectId: string; position: number; requestId: string | null; sessionId: string | null };

const KICH_THUOC_LO = 20;
const CHO_MS = 3000;

let hangDoi: Muc[] = [];
let hen: ReturnType<typeof setTimeout> | null = null;
const daHien = new Set<string>();

function flush() {
  if (hen) {
    clearTimeout(hen);
    hen = null;
  }
  if (hangDoi.length === 0) return;
  const lo = hangDoi.slice(0, 100);
  hangDoi = hangDoi.slice(100);
  void api("/reco/events", { method: "POST", body: { events: lo } }).catch(() => undefined);
  if (hangDoi.length > 0) flush();
}

function them(m: Muc) {
  hangDoi.push(m);
  if (hangDoi.length >= KICH_THUOC_LO) flush();
  else if (!hen) hen = setTimeout(() => flush(), CHO_MS);
}

/** Thẻ thật sự hiện trên màn (IntersectionObserver ≥ 60 %). Một dự án chỉ ghi một lần mỗi phiên. */
export function ghiHienThe(projectId: string, position: number, requestId: string, sessionId: string) {
  const khoa = sessionId + ":" + projectId;
  if (daHien.has(khoa)) return;
  daHien.add(khoa);
  them({ kind: "impression", projectId, position, requestId, sessionId });
}

export function ghiMoThe(projectId: string, position: number, requestId: string | null, sessionId: string | null) {
  them({ kind: "open", projectId, position, requestId, sessionId });
}

/** "Không quan tâm" gửi NGAY (dự án biến khỏi trang sau). */
export async function khongQuanTam(projectId: string, position: number, requestId: string | null, sessionId: string | null) {
  flush();
  await api("/reco/events", { method: "POST", body: { events: [{ kind: "not_interested", projectId, position, requestId, sessionId }] } });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
