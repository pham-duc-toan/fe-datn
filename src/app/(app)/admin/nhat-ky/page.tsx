"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Link2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { Field, JsonView, KeyValue } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api } from "@/lib/api";
import { AUDIT_EVENT, AUDIT_FIELD, AUDIT_GROUPS, AUDIT_VALUE_LABEL, auditEventName } from "@/lib/audit-events";
import { errorMessage } from "@/lib/errors";
import { formatBytes, formatDateTime, formatDuration, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, ROLE_LABEL } from "@/lib/labels";
import type { Paged } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

type Ev = { eventId: string; eventType: string; producer: string; occurredAt: string; correlationId: string; causationId: string | null; actorId: string | null; actorRole: string | null; payload: unknown };
type Filter = { eventType: string; actorId: string; actorLabel: string; correlationId: string; from: string; to: string };
type SettingInfo = { key: string; name: string; type: string; unit: string };
type SettingMap = Record<string, SettingInfo>;

const ALL = "__all";
const EMPTY: Filter = { eventType: "", actorId: "", actorLabel: "", correlationId: "", from: "", to: "" };

function useSettingNames(): SettingMap {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<SettingInfo[]>("/admin/settings"), staleTime: 5 * 60_000 });
  const m: SettingMap = {};
  for (const s of q.data ?? []) m[s.key] = s;
  return m;
}

/** Giá trị setting theo đơn vị dễ đọc (thời gian, dung lượng, bật / tắt). */
function settingValue(info: SettingInfo | undefined, v: unknown): string {
  if (typeof v === "boolean") return v ? "Bật" : "Tắt";
  if (info?.type === "durationSeconds" && typeof v === "number") return formatDuration(v);
  if (info?.unit === "byte" && typeof v === "number") return formatBytes(v);
  return typeof v === "string" ? v : JSON.stringify(v);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function plain(field: string, v: unknown, settingNames: SettingMap): string {
  const map = AUDIT_VALUE_LABEL[field];
  const one = (x: unknown): string => {
    const s = typeof x === "string" ? x : typeof x === "number" ? String(x) : JSON.stringify(x);
    if (map && map[s]) return map[s];
    if (field === "role" || field === "roles") return ROLE_LABEL[s] ?? s;
    if (field === "modality") return MODALITY_LABEL[s as keyof typeof MODALITY_LABEL] ?? s;
    if (field === "key") return settingNames[s]?.name || s;
    return s;
  };
  return Array.isArray(v) ? v.map(one).join(", ") : one(v);
}

/** Một trường của nội dung, hiện theo kiểu (người dùng, dự án, tiền, ngày giờ...). */
function FieldValue({ field, value, payload, settingNames }: { field: string; value: unknown; payload: Record<string, unknown>; settingNames: SettingMap }) {
  const kind = AUDIT_FIELD[field]?.kind ?? "text";
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (field === "value" && typeof payload.key === "string") return <>{settingValue(settingNames[payload.key], value)}</>;
  if (kind === "user" && typeof value === "string") return <UserName id={value} />;
  if (kind === "users" && Array.isArray(value))
    return (
      <span className="flex flex-wrap justify-end gap-x-2">
        {value.map((u) => (
          <UserName key={String(u)} id={String(u)} />
        ))}
      </span>
    );
  if (kind === "project" && typeof value === "string")
    return (
      <Link href={`/admin/du-an/${value}`} className="text-primary hover:underline">
        {typeof payload.projectName === "string" ? payload.projectName : "Xem dự án"}
      </Link>
    );
  if (kind === "money" && typeof value === "number") return <>{formatVnd(value)}</>;
  if (kind === "percent" && typeof value === "number") return <>{value}%</>;
  if (kind === "date" && typeof value === "string") return <>{formatDateTime(value)}</>;
  if (kind === "bool" || typeof value === "boolean") return <>{value ? "Có" : "Không"}</>;
  return <span className="break-all">{plain(field, value, settingNames)}</span>;
}

/** Tóm tắt một dòng: tên dự án / số tiền / cài đặt / lý do — tuỳ sự kiện có gì. */
function summary(e: Ev, settingNames: SettingMap): string {
  const p = asRecord(e.payload);
  const parts: string[] = [];
  if (typeof p.projectName === "string") parts.push(p.projectName);
  if (e.eventType === "setting.changed" && typeof p.key === "string") parts.push(`${settingNames[p.key]?.name || p.key} → ${settingValue(settingNames[p.key], p.value)}`);
  if (typeof p.amountVnd === "number") parts.push(formatVnd(p.amountVnd));
  if (typeof p.title === "string") parts.push(p.title);
  if (typeof p.reason === "string" && p.reason) parts.push(`Lý do: ${p.reason}`);
  return parts.join(" · ");
}

function Detail({ e, settingNames, onRelated }: { e: Ev; settingNames: SettingMap; onRelated: () => void }) {
  const p = asRecord(e.payload);
  // Chỉ hiện các trường có tên dễ hiểu; phần còn lại (mã nội bộ, dữ liệu kỹ thuật) nằm trong "Dữ liệu gốc".
  const items: [ReactNode, ReactNode][] = Object.keys(AUDIT_FIELD)
    .filter((k) => k in p && p[k] !== null && p[k] !== undefined && !(k === "projectName" && typeof p.projectId === "string"))
    .map((k) => [AUDIT_FIELD[k].label, <FieldValue key={k} field={k} value={p[k]} payload={p} settingNames={settingNames} />]);
  return (
    <div className="space-y-3 py-1">
      {items.length > 0 ? <KeyValue items={items} /> : <p className="text-sm text-muted-foreground">Không có thông tin thêm.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={onRelated}>
          <Link2 /> Xem các việc liên quan
        </Button>
        <span className="text-xs text-muted-foreground">Những việc hệ thống làm tiếp theo sau thao tác này (vd: publish → ký quỹ → dự án chạy).</span>
      </div>
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3" /> Dữ liệu gốc (dành cho đội kỹ thuật)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {e.eventType} · {e.producer} · {e.correlationId}
          </p>
          <JsonView value={e.payload} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function AuditPage() {
  const [form, setForm] = useState<Filter>(EMPTY);
  const [actorText, setActorText] = useState("");
  const [filter, setFilter] = useState<Filter>(EMPTY);
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
  const settingNames = useSettingNames();
  const q = useQuery({
    queryKey: ["audit", filter, page],
    queryFn: () =>
      api<Paged<Ev>>("/admin/audit", {
        query: {
          eventType: filter.eventType || undefined,
          actorId: filter.actorId || undefined,
          correlationId: filter.correlationId || undefined,
          from: filter.from ? new Date(filter.from).toISOString() : undefined,
          to: filter.to ? new Date(filter.to).toISOString() : undefined,
          page,
          pageSize: 50,
        },
      }),
  });

  const apply = (f: Filter) => {
    setForm(f);
    setFilter(f);
    setPage(1);
    setOpen(null);
  };

  /** Người làm: gõ username / email → tìm tài khoản để lọc. */
  async function submit() {
    const text = actorText.trim().replace(/^@/, "");
    if (!text) return apply({ ...form, actorId: "", actorLabel: "" });
    if (text === form.actorLabel && form.actorId) return apply(form);
    try {
      const r = await api<Paged<{ userId: string; username?: string; email: string }>>("/users/admin", { query: { search: text, page: 1, pageSize: 10 } });
      const low = text.toLowerCase();
      const u = r.items.find((x) => x.username?.toLowerCase() === low || x.email.toLowerCase() === low) ?? (r.items.length === 1 ? r.items[0] : undefined);
      if (!u) {
        toast.error(r.items.length ? "Có nhiều tài khoản khớp — gõ đủ username hoặc email." : "Không tìm thấy tài khoản nào.");
        return;
      }
      apply({ ...form, actorId: u.userId, actorLabel: text });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Nhật ký hoạt động" description="Ghi lại mọi thao tác quan trọng của người dùng và quản trị viên. Không ai sửa hay xoá được." />
      <form
        className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Loại hoạt động">
          <Select value={form.eventType || ALL} onValueChange={(v) => setForm({ ...form, eventType: v === ALL ? "" : v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              {AUDIT_GROUPS.map((g) => (
                <SelectGroup key={g}>
                  <SelectLabel>{g}</SelectLabel>
                  {Object.entries(AUDIT_EVENT)
                    .filter(([, v]) => v.group === g)
                    .map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Người thực hiện">
          <Input placeholder="username hoặc email" value={actorText} onChange={(e) => setActorText(e.target.value)} />
        </Field>
        <Field label="Từ">
          <Input type="datetime-local" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </Field>
        <Field label="Đến">
          <Input type="datetime-local" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </Field>
        <Button type="submit" variant="outline">
          <Search /> Lọc
        </Button>
      </form>
      {filter.correlationId && (
        <Alert className="mb-4">
          <Link2 />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Đang xem các việc liên quan đến một thao tác.
            <Button size="xs" variant="ghost" onClick={() => apply({ ...form, correlationId: "" })}>
              <X /> Bỏ lọc
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 pl-4" />
                      <TableHead>Lúc</TableHead>
                      <TableHead>Hoạt động</TableHead>
                      <TableHead>Người thực hiện</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((e) => {
                      const isOpen = open === e.eventId;
                      const sum = summary(e, settingNames);
                      return (
                        <Fragment key={e.eventId}>
                          <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : e.eventId)}>
                            <TableCell className="pl-4">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{auditEventName(e.eventType)}</div>
                              {sum && <div className="text-xs text-muted-foreground">{sum}</div>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {e.actorId ? <UserName id={e.actorId} /> : <span className="text-muted-foreground">Hệ thống tự động</span>}{" "}
                              {e.actorRole && <span className="text-xs text-muted-foreground">({ROLE_LABEL[e.actorRole] ?? e.actorRole})</span>}
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow>
                              <TableCell />
                              <TableCell colSpan={3}>
                                <Detail e={e} settingNames={settingNames} onRelated={() => {
                                    setActorText("");
                                    apply({ ...EMPTY, correlationId: e.correlationId });
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="px-4 pb-3">
                  <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
                </div>
              </>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </>
  );
}
