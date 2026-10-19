"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Braces, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/misc";
import { FreeTextNotice } from "@/components/project/free-text-notice";
import type { AttributeDef, LabelSchema, Modality, Tool, ToolKind } from "@/lib/types";
import { CLASS_TOOLS, LIST_TOOLS, TOOL_LABEL, TOOLS_BY_MODALITY } from "@/lib/labels";

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const parseClasses = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

function AttributeEditor({ attrs, onChange }: { attrs: AttributeDef[]; onChange: (a: AttributeDef[]) => void }) {
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Thuộc tính của từng đối tượng (tối đa 20)</span>
        <Button type="button" size="xs" variant="outline" onClick={() => onChange(attrs.concat([{ name: `thuoc_tinh_${attrs.length + 1}`, type: "text" }]))}>
          <Plus /> Thêm
        </Button>
      </div>
      {attrs.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2">
          <Input className="h-7" value={a.name} onChange={(e) => onChange(attrs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
          <Select value={a.type} onValueChange={(v) => onChange(attrs.map((x, k) => (k === i ? { ...x, type: v as AttributeDef["type"], options: v === "choice" ? x.options ?? ["a", "b"] : undefined } : x)))}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Chữ</SelectItem>
              <SelectItem value="choice">Lựa chọn</SelectItem>
              <SelectItem value="boolean">Có / không</SelectItem>
              <SelectItem value="number">Số</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1 text-xs">
            <Checkbox checked={Boolean(a.required)} onCheckedChange={(c) => onChange(attrs.map((x, k) => (k === i ? { ...x, required: c === true } : x)))} /> bắt buộc
          </label>
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => onChange(attrs.filter((_, k) => k !== i))}>
            <Trash2 />
          </Button>
          {a.type === "choice" && (
            <Input
              className="col-span-4 h-7"
              placeholder="Các lựa chọn, ngăn cách bằng dấu phẩy"
              value={(a.options ?? []).join(", ")}
              onChange={(e) => onChange(attrs.map((x, k) => (k === i ? { ...x, options: parseClasses(e.target.value) } : x)))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ToolEditor({ tool, modality, all, onChange, onRemove, onMove }: { tool: Tool; modality: Modality; all: Tool[]; onChange: (t: Tool) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  const [classText, setClassText] = useState((tool.classes ?? []).join("\n"));
  const set = (patch: Partial<Tool>) => onChange({ ...tool, ...patch });
  const hasClasses = CLASS_TOOLS.includes(tool.kind);
  const isListTool = LIST_TOOLS.includes(tool.kind);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Tên (khoá)" hint="a-z, 0-9, _" className="w-44">
          <Input className="h-8" value={tool.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Loại công cụ" className="w-56">
          <Select value={tool.kind} onValueChange={(v) => onChange({ name: tool.name, kind: v as ToolKind, required: tool.required, classes: CLASS_TOOLS.includes(v as ToolKind) ? tool.classes ?? ["lop_1", "lop_2"] : undefined })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOOLS_BY_MODALITY[modality].map((k) => (
                <SelectItem key={k} value={k}>
                  {TOOL_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex h-8 items-center gap-1.5 text-sm">
          <Checkbox checked={tool.required !== false} onCheckedChange={(c) => set({ required: c === true })} /> Bắt buộc
        </label>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onMove(-1)} aria-label="Lên">
            <ArrowUp />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onMove(1)} aria-label="Xuống">
            <ArrowDown />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Xoá">
            <Trash2 />
          </Button>
        </div>
      </div>
      {hasClasses && (
        <Field label="Các lớp" hint={tool.kind === "classification" ? "Mỗi dòng một lớp, ≥ 2 lớp" : "Mỗi dòng một lớp"}>
          <Textarea
            rows={3}
            value={classText}
            onChange={(e) => {
              setClassText(e.target.value);
              set({ classes: parseClasses(e.target.value) });
            }}
          />
        </Field>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        {tool.kind === "classification" && (
          <label className="flex items-center gap-1.5">
            <Checkbox checked={Boolean(tool.allowMultiple)} onCheckedChange={(c) => set({ allowMultiple: c === true })} /> Cho chọn nhiều lớp
          </label>
        )}
        {tool.kind === "bbox" && (
          <label className="flex items-center gap-1.5">
            <Checkbox checked={Boolean(tool.rotatable)} onCheckedChange={(c) => set({ rotatable: c === true || undefined })} /> Khung xoay được
          </label>
        )}
        {tool.kind === "pairwise" && (
          <label className="flex items-center gap-1.5">
            <Checkbox checked={tool.allowTie !== false} onCheckedChange={(c) => set({ allowTie: c === true })} /> Cho chọn “ngang nhau”
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {isListTool && (
          <>
            <Field label="Tối thiểu" className="w-24">
              <Input className="h-8" type="number" value={tool.minItems ?? ""} onChange={(e) => set({ minItems: numOrNull(e.target.value) ?? undefined })} />
            </Field>
            <Field label="Tối đa" className="w-24">
              <Input className="h-8" type="number" value={tool.maxItems ?? ""} onChange={(e) => set({ maxItems: numOrNull(e.target.value) ?? undefined })} />
            </Field>
          </>
        )}
        {tool.kind === "freeText" && <FreeTextNotice audience="business" className="basis-full" />}
        {(tool.kind === "transcription" || tool.kind === "freeText") && (
          <Field label="Độ dài tối đa" className="w-32">
            <Input className="h-8" type="number" value={tool.maxLength ?? ""} onChange={(e) => set({ maxLength: numOrNull(e.target.value) ?? undefined })} />
          </Field>
        )}
        {!["classification", "pairwise", "freeText", "number"].includes(tool.kind) && (
          <Field label="Ngưỡng khớp (0–1)" hint="Trống = mặc định" className="w-36">
            <Input className="h-8" type="number" step="0.05" value={tool.matchThreshold ?? ""} onChange={(e) => set({ matchThreshold: numOrNull(e.target.value) })} />
          </Field>
        )}
        {tool.kind === "number" && (
          <>
            <Field label="Nhỏ nhất" className="w-24">
              <Input className="h-8" type="number" value={tool.min ?? ""} onChange={(e) => set({ min: numOrNull(e.target.value) })} />
            </Field>
            <Field label="Lớn nhất" className="w-24">
              <Input className="h-8" type="number" value={tool.max ?? ""} onChange={(e) => set({ max: numOrNull(e.target.value) })} />
            </Field>
            <Field label="Lệch cho phép" className="w-28">
              <Input className="h-8" type="number" value={tool.tolerance ?? ""} onChange={(e) => set({ tolerance: numOrNull(e.target.value) ?? undefined })} />
            </Field>
            <label className="flex items-center gap-1.5 self-end pb-1.5 text-sm">
              <Checkbox checked={Boolean(tool.integer)} onCheckedChange={(c) => set({ integer: c === true })} /> Số nguyên
            </label>
          </>
        )}
        {tool.kind === "relation" && (
          <Field label="Công cụ đoạn (span) gốc" className="w-56">
            <Select value={tool.spanTool ?? ""} onValueChange={(v) => set({ spanTool: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn công cụ span" />
              </SelectTrigger>
              <SelectContent>
                {all.filter((t) => t.kind === "span").map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {isListTool && tool.kind !== "relation" && <AttributeEditor attrs={tool.attributes ?? []} onChange={(a) => set({ attributes: a.length ? a : undefined })} />}
    </div>
  );
}

export function SchemaEditor({ modality, value, onChange }: { modality: Modality; value: LabelSchema; onChange: (s: LabelSchema) => void }) {
  const [json, setJson] = useState<string | null>(null);
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const tools = value.tools;
  const setTools = (t: Tool[]) => onChange({ ...value, tools: t });

  if (json !== null)
    return (
      <div className="space-y-2">
        <Textarea rows={18} className="font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
        {jsonErr && <p className="text-sm text-destructive">{jsonErr}</p>}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              try {
                const s = JSON.parse(json) as LabelSchema;
                onChange({ ...s, modality });
                setJson(null);
                setJsonErr(null);
              } catch (e) {
                setJsonErr((e as Error).message);
              }
            }}
          >
            Áp dụng JSON
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setJson(null)}>
            Huỷ
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      {(modality === "audio" || modality === "video") && (
        <Field label="Cắt file dài thành đoạn (giây)" hint="5–3600. Bỏ trống = mỗi file một câu." className="max-w-xs">
          <Input type="number" value={value.segmentSeconds ?? ""} onChange={(e) => onChange({ ...value, segmentSeconds: numOrNull(e.target.value) })} />
        </Field>
      )}
      {tools.map((t, i) => (
        <ToolEditor
          key={i}
          tool={t}
          modality={modality}
          all={tools}
          onChange={(nt) => setTools(tools.map((x, k) => (k === i ? nt : x)))}
          onRemove={() => setTools(tools.filter((_, k) => k !== i))}
          onMove={(d) => {
            const j = i + d;
            if (j < 0 || j >= tools.length) return;
            const next = tools.slice();
            [next[i], next[j]] = [next[j], next[i]];
            setTools(next);
          }}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={tools.length >= 20}
          onClick={() => setTools(tools.concat([{ name: `cong_cu_${tools.length + 1}`, kind: "classification", classes: ["lop_1", "lop_2"], required: true }]))}
        >
          <Plus /> Thêm công cụ
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setJson(JSON.stringify({ ...value, modality }, null, 2))}>
          <Braces /> Sửa JSON
        </Button>
      </div>
    </div>
  );
}
