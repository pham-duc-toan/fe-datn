import type { Tool, ToolKind } from "@/lib/types";

/** Bỏ dấu tiếng Việt, về chữ thường a-z 0-9 nối bằng "_" (khoá công cụ: ^[a-z][a-z0-9_]{0,39}$). */
export function slugVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const kindSlug = (k: ToolKind) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/**
 * Khoá công cụ tự sinh = tên dự án không dấu + loại công cụ (vd "phan_loai_xe_bbox"); trùng thì thêm _2, _3…
 * Doanh nghiệp không phải đặt tên — khoá chỉ dùng làm tên trường trong file xuất kết quả.
 */
export function autoToolName(projectName: string, kind: ToolKind, others: Pick<Tool, "name">[]): string {
  const duoi = kindSlug(kind);
  let goc = slugVi(projectName);
  if (!goc || !/^[a-z]/.test(goc)) goc = `du_an${goc ? `_${goc}` : ""}`;
  const taken = new Set(others.map((t) => t.name));
  for (let i = 1; ; i++) {
    const hau = i === 1 ? `_${duoi}` : `_${duoi}_${i}`;
    const ten = `${goc.slice(0, 40 - hau.length).replace(/_+$/, "")}${hau}`;
    if (!taken.has(ten)) return ten;
  }
}

/** Tên lô dữ liệu tự sinh = tên dự án + ngày giờ nạp (doanh nghiệp không phải đặt). */
export function autoBatchName(projectName: string, d: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${projectName.trim().slice(0, 60)} – ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Quy tắc username giống backend (User.LoiUsername): 3–30 ký tự a-z 0-9 . _, không bắt đầu / kết thúc bằng . _ */
export function usernameError(raw: string): string | null {
  const s = raw.trim().replace(/^@/, "").toLowerCase();
  if (s.length < 3 || s.length > 30) return "Username phải từ 3 đến 30 ký tự.";
  if (!/^[a-z0-9._]+$/.test(s)) return "Username chỉ gồm chữ thường không dấu a-z, số 0-9, dấu chấm và gạch dưới.";
  if (/^[._]|[._]$/.test(s)) return "Username không được bắt đầu hay kết thúc bằng dấu chấm / gạch dưới.";
  return null;
}

/** Gợi ý username từ email (phần trước @, bỏ ký tự lạ). */
export function suggestUsername(email: string): string {
  let s = slugVi(email.split("@")[0] ?? "").replace(/_+/g, "_");
  s = s.slice(0, 24).replace(/^[._]+|[._]+$/g, "");
  return s.length >= 3 ? s : s ? `${s}user` : "";
}
