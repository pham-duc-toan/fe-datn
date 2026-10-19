"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

/**
 * Bọc một thao tác ghi: hiện toast lỗi theo mã lỗi backend, toast thành công (nếu có),
 * và làm mới các query liên quan.
 */
export function useAction<TArgs = void, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); invalidate?: QueryKey[]; onSuccess?: (r: TResult, args: TArgs) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation<TResult, unknown, TArgs>({
    mutationFn: fn,
    onSuccess: async (r, args) => {
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r) : opts.success);
      if (opts.invalidate) await Promise.all(opts.invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      opts.onSuccess?.(r, args);
    },
    onError: (e) => {
      if (!opts.silentError) toast.error(errorMessage(e));
    },
  });
}
