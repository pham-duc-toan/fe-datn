/** Địa chỉ gateway của backend — mọi API đi qua đây (tích hợp FE mục 1). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18080").replace(/\/+$/, "");

/** WebSocket thông báo realtime cũng qua gateway (mục 17.9). */
export const WS_URL = API_URL.replace(/^http/, "ws");

export const APP_NAME = "Crowd Label";
