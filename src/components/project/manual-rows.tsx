"use client";

import { useState } from "react";
import { FileUp, ListPlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/misc";
import type { Modality } from "@/lib/types";

/** Một mẫu đang soạn tay. text: `a`; pair: `a` + `b`; list: `items`. `question` = câu hỏi riêng (mọi loại). */
type Draft = { key: number; name: string; question: string; a: string; b: string; items: string[] };

const MIN_ITEMS = 2;
const MAX_ITEMS = 50;

let nextKey = 1;
const blank = (modality: Modality): Draft => ({
  key: nextKey++,
  name: "",
  question: "",
  a: "",
  b: "",
  items: modality === "list" ? ["", ""] : [],
});

/** Dòng JSON đúng định dạng backend (POST /projects/{id}/samples), hoặc lý do chưa hợp lệ. */
function toRow(modality: Modality, d: Draft): { row: Record<string, unknown> } | { error: string } {
  const row: Record<string, unknown> = {};
  if (d.name.trim()) row.name = d.name.trim();
  if (d.question.trim()) row.question = d.question.trim();
  if (modality === "text") {
    if (!d.a.trim()) return { error: "chưa nhập nội dung" };
    row.text = d.a.trim();
  } else if (modality === "pair") {
    if (!d.a.trim() || !d.b.trim()) return { error: "cần cả câu trả lời A và B" };
    row.a = d.a.trim();
    row.b = d.b.trim();
  } else if (modality === "list") {
    const items = d.items.map((x) => x.trim());
    if (items.length < MIN_ITEMS || items.some((x) => !x)) return { error: `cần ít nhất ${MIN_ITEMS} mục, mỗi mục không để trống` };
    row.items = items;
  }
  return { row };
}

const LABEL: Record<string, string> = { text: "văn bản", pair: "cặp câu trả lời", list: "danh sách" };

/** Ô ngữ cảnh / câu hỏi RIÊNG của một mẫu (tuỳ chọn) — hiện ở đầu câu, không thay câu hỏi của công cụ. */
export function QuestionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Ngữ cảnh riêng của mẫu (tuỳ chọn)" hint="Hiện ở đầu câu, phía trên mẫu — vd câu hỏi gốc của cặp câu trả lời. Câu hỏi của từng công cụ đặt ở tab Cấu hình.">
      <Input value={value} maxLength={1000} onChange={(e) => onChange(e.target.value)} placeholder="vd: Thủ đô của Việt Nam là gì?" />
    </Field>
  );
}

/**
 * Nhập mẫu bằng tay cho văn bản / cặp / danh sách — doanh nghiệp không phải biết JSON. Mỗi mẫu một khối;
 * văn bản có thêm "dán nhiều mẫu" (mỗi dòng một mẫu).
 */
export function ManualRows({
  modality,
  busy,
  onSubmit,
}: {
  modality: Modality;
  busy: boolean;
  onSubmit: (rows: Record<string, unknown>[]) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank(modality)]);
  const [bulk, setBulk] = useState("");
  const [errors, setErrors] = useState<Record<number, string>>({});

  const patch = (key: number, f: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...f } : d)));
  const remove = (key: number) => setDrafts((ds) => (ds.length > 1 ? ds.filter((d) => d.key !== key) : [blank(modality)]));

  function addBulk() {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const filled = drafts.filter((d) => d.a.trim());
    setDrafts([...filled, ...lines.map((l) => ({ ...blank(modality), a: l }))]);
    setBulk("");
  }

  async function submit() {
    const rows: Record<string, unknown>[] = [];
    const bad: Record<number, string> = {};
    for (const d of drafts) {
      const empty = !d.a.trim() && !d.b.trim() && d.items.every((x) => !x.trim());
      if (empty) continue; // khối trống bỏ qua
      const r = toRow(modality, d);
      if ("error" in r) bad[d.key] = r.error;
      else rows.push(r.row);
    }
    setErrors(bad);
    if (Object.keys(bad).length > 0 || rows.length === 0) return;
    if (await onSubmit(rows)) setDrafts([blank(modality)]);
  }

  const filled = drafts.filter((d) => d.a.trim() || d.b.trim() || d.items.some((x) => x.trim())).length;

  return (
    <div className="space-y-4">
      {modality === "text" && (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <Field label="Dán nhiều mẫu cùng lúc" hint="Mỗi dòng là một mẫu văn bản.">
            <Textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Sản phẩm dùng rất tốt\nGiao hàng chậm, thái độ nhân viên chưa tốt\n…"} />
          </Field>
          <Button type="button" variant="outline" size="sm" onClick={addBulk} disabled={!bulk.trim()}>
            <ListPlus /> Thêm {bulk.split("\n").filter((l) => l.trim()).length || ""} mẫu vào danh sách
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div key={d.key} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Mẫu {i + 1} <span className="font-normal text-muted-foreground">({LABEL[modality]})</span>
              </span>
              <Button type="button" size="icon-xs" variant="ghost" onClick={() => remove(d.key)} aria-label={`Xoá mẫu ${i + 1}`}>
                <Trash2 />
              </Button>
            </div>

            {modality === "text" && (
              <Field label="Nội dung văn bản">
                <Textarea rows={3} value={d.a} onChange={(e) => patch(d.key, { a: e.target.value })} />
              </Field>
            )}

            <QuestionInput value={d.question} onChange={(v) => patch(d.key, { question: v })} />

            {modality === "pair" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Câu trả lời A">
                    <Textarea rows={3} value={d.a} onChange={(e) => patch(d.key, { a: e.target.value })} />
                  </Field>
                  <Field label="Câu trả lời B">
                    <Textarea rows={3} value={d.b} onChange={(e) => patch(d.key, { b: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {modality === "list" && (
              <>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Các mục cần xếp hạng ({MIN_ITEMS}–{MAX_ITEMS})</span>
                  {d.items.map((it, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{k + 1}.</span>
                      <Input value={it} onChange={(e) => patch(d.key, { items: d.items.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Mục ${k + 1}`} />
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={d.items.length <= MIN_ITEMS}
                        onClick={() => patch(d.key, { items: d.items.filter((_, j) => j !== k) })}
                        aria-label={`Xoá mục ${k + 1}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" disabled={d.items.length >= MAX_ITEMS} onClick={() => patch(d.key, { items: [...d.items, ""] })}>
                    <Plus /> Thêm mục
                  </Button>
                </div>
              </>
            )}

            <Field label="Tên để đối chiếu (tuỳ chọn)" hint="Hiện ở trang kết quả, giúp bạn nhận ra mẫu.">
              <Input value={d.name} onChange={(e) => patch(d.key, { name: e.target.value })} />
            </Field>
            {errors[d.key] && <p className="text-sm text-destructive">Mẫu {i + 1}: {errors[d.key]}.</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setDrafts((ds) => [...ds, blank(modality)])}>
          <Plus /> Thêm mẫu
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={busy || filled === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Nạp {filled} mẫu
        </Button>
      </div>
    </div>
  );
}
