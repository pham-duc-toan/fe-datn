import { API_URL } from "./config";
import { readTokens, tokenPairFromResponse, writeTokens, type TokenPair } from "./tokens";

/** Lỗi từ backend dạng ProblemDetails — luôn có `code` ổn định để dịch (mục 1, 9). */
export class ApiError extends Error {
  status: number;
  code: string;
  detail: string | null;
  traceId: string | null;
  /** Giây phải chờ (429: header Retry-After hoặc retryAfterSeconds). */
  retryAfter: number | null;
  /** Toàn bộ body lỗi (vd closeCheck, attemptsLeft, errors). */
  data: Record<string, unknown>;

  constructor(status: number, data: Record<string, unknown>, retryAfter: number | null) {
    const code = (typeof data.code === "string" && data.code) || (typeof data.title === "string" && data.title) || `http_${status}`;
    super(typeof data.detail === "string" ? data.detail : code);
    this.status = status;
    this.code = code;
    this.detail = typeof data.detail === "string" ? data.detail : null;
    this.traceId = typeof data.traceId === "string" ? data.traceId : null;
    this.retryAfter = retryAfter;
    this.data = data;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Gửi kèm access token (mặc định có). */
  auth?: boolean;
  /** Header Idempotency-Key cho API tiền (mục 4.1, 5.7). */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

type SessionEndedListener = (reason: string) => void;
const sessionEndedListeners = new Set<SessionEndedListener>();

/** AuthProvider nghe để đưa người dùng về trang đăng nhập khi phiên kết thúc. */
export function onSessionEnded(l: SessionEndedListener): () => void {
  sessionEndedListeners.add(l);
  return () => {
    sessionEndedListeners.delete(l);
  };
}

function endSession(reason: string) {
  writeTokens(null);
  sessionEndedListeners.forEach((l) => l(reason));
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

let refreshing: Promise<TokenPair | null> | null = null;

async function doRefresh(used: string): Promise<TokenPair | null> {
  const res = await fetch(API_URL + "/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: used }),
  });
  if (!res.ok) return null;
  const pair = tokenPairFromResponse(await res.json());
  writeTokens(pair);
  return pair;
}

/**
 * Làm mới token MỘT lần cho mọi request đang chờ, và khoá giữa các tab (Web Locks):
 * tab đến sau thấy cặp token đã đổi thì dùng luôn, không gửi lại refresh token cũ (mục 2.3).
 */
export function refreshTokens(): Promise<TokenPair | null> {
  if (refreshing) return refreshing;
  const used = readTokens()?.refreshToken;
  if (!used) return Promise.resolve(null);
  const run = async (): Promise<TokenPair | null> => {
    const cur = readTokens();
    if (!cur) return null;
    if (cur.refreshToken !== used) return cur;
    return doRefresh(used);
  };
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  const p: Promise<TokenPair | null> = locks ? (locks.request("crowd-refresh", run) as unknown as Promise<TokenPair | null>) : run();
  const shared = p.finally(() => {
    refreshing = null;
  });
  refreshing = shared;
  return shared;
}

async function parseError(res: Response): Promise<ApiError> {
  let data: Record<string, unknown> = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  let retryAfter: number | null = null;
  const h = res.headers.get("Retry-After");
  if (h && !Number.isNaN(Number(h))) retryAfter = Number(h);
  else if (typeof data.retryAfterSeconds === "number") retryAfter = data.retryAfterSeconds;
  return new ApiError(res.status, data, retryAfter);
}

async function send(path: string, opts: ApiOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body,
    signal: opts.signal,
  });
}

/** Gọi API, tự làm mới token khi gặp 401 (trừ phien_da_bi_thu_hoi). Trả Response thô. */
export async function apiFetch(path: string, opts: ApiOptions = {}): Promise<Response> {
  const auth = opts.auth !== false;
  let tokens = auth ? readTokens() : null;
  if (auth && tokens && tokens.expiresAt - Date.now() < 20_000) {
    tokens = (await refreshTokens()) ?? tokens;
  }
  let res = await send(path, opts, tokens?.accessToken ?? null);
  if (res.status === 401 && auth && tokens) {
    const err = await parseError(res.clone());
    if (err.code === "phien_da_bi_thu_hoi") {
      endSession(err.code);
      throw err;
    }
    const fresh = await refreshTokens();
    if (!fresh) {
      endSession("phien_khong_hop_le");
      throw err;
    }
    res = await send(path, opts, fresh.accessToken);
    if (res.status === 401) {
      const err2 = await parseError(res.clone());
      endSession(err2.code);
      throw err2;
    }
  }
  if (!res.ok) throw await parseError(res);
  return res;
}

/** Gọi API trả JSON (204 → undefined). */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const get = <T,>(path: string, query?: Query) => api<T>(path, { query });
export const post = <T,>(path: string, body?: unknown, extra?: Omit<ApiOptions, "body" | "method">) =>
  api<T>(path, { ...extra, method: "POST", body: body ?? {} });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: "DELETE" });

function fileNameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

/** Tải file có Authorization (thẻ <a href> không gửi được token — mục 4.11). */
export async function downloadFile(path: string, query: Query | undefined, fallbackName: string): Promise<void> {
  const res = await apiFetch(path, { query });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFrom(res, fallbackName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Mở bản HTML có Authorization ở tab mới (hoá đơn in được). */
export async function openHtml(path: string): Promise<void> {
  const w = window.open("", "_blank");
  const res = await apiFetch(path);
  const html = await res.text();
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  if (w) w.location.href = url;
  else window.location.href = url;
}

/** Đẩy file thẳng lên link ký sẵn của kho file (không kèm Authorization), có tiến độ. */
export function uploadToSignedUrl(url: string, file: Blob, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Tải file lên thất bại, thử lại sau.")));
    xhr.onerror = () => reject(new Error("Không tải file lên được — kiểm tra kết nối mạng rồi thử lại."));
    xhr.send(file);
  });
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
