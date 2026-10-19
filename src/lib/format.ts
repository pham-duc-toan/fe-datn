const vnd = new Intl.NumberFormat("vi-VN");

/** Tiền là số nguyên đồng (mục 1). */
export function formatVnd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${vnd.format(n)} đ`;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) return "sắp tới";
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return formatDate(iso);
}

export function formatSeconds(total: number): string {
  if (!Number.isFinite(total)) return "—";
  const sign = total < 0 ? "-" : "";
  const t = Math.abs(total);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${sign}${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (seconds % 86400 === 0 && seconds >= 86400) return `${seconds / 86400} ngày`;
  if (seconds % 3600 === 0 && seconds >= 3600) return `${seconds / 3600} giờ`;
  if (seconds % 60 === 0 && seconds >= 60) return `${seconds / 60} phút`;
  return `${seconds} giây`;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** Hiển thị mã mời dạng K7QX-3MWP-A9TR-HC2N (mục 4.9). */
export function formatInviteCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

/** "YYYY-MM-DD" theo giờ máy (ngày giờ Việt Nam ở backend). */
export function isoDay(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}
