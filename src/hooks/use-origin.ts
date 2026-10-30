"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `window.location.origin` an toàn khi SSR: server và lần hydrate đầu trả "", sau đó mới là origin thật
 * — tránh lỗi hydration do HTML server khác client.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}
