"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw, Save, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { Loading, QueryState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { api, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatDuration } from "@/lib/format";

type Setting = { key: string; name: string; group: string; type: string; unit: string; min: number | null; max: number | null; effect: string; description: string; choices: string[] | null; defaultValue: unknown; value: unknown; version: number; updatedAt: string | null; updatedBy: string | null };

const HIGHLIGHT = new Set(["project.auto_approve", "annotation.auto_approve_agreed", "ledger.withdraw_auto_approve", "ledger.withdraw_auto_approve_max_vnd", "payment.manual_transfer_enabled", "payment.manual_transfer_auto_approve_max_vnd", "fee.platform_percent"]);

function show(v: unknown, s: Setting): string {
  if (v === null || v === undefined) return "—";
  if (s.type === "durationSeconds" && typeof v === "number") return formatDuration(v);
  if (typeof v === "boolean") return v ? "Bật" : "Tắt";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function HistoryButton({ k }: { k: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["setting-history", k], queryFn: () => api<{ version: number; oldValue: unknown; newValue: unknown; changedBy: string | null; changedAt: string; reason: string | null }[]>(`/admin/settings/${k}/history`), enabled: open });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Lịch sử">
          <History />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{k}</DialogTitle>
        </DialogHeader>
        {q.isPending ? (
          <Loading />
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa thay đổi lần nào.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {q.data!.map((h) => (
              <li key={h.version} className="border-b pb-2">
                <div className="flex justify-between">
                  <span>
                    v{h.version}: <code>{JSON.stringify(h.oldValue)}</code> → <code>{JSON.stringify(h.newValue)}</code>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(h.changedAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <UserName id={h.changedBy} fallback="hệ thống" /> {h.reason && `— ${h.reason}`}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ s }: { s: Setting }) {
  const qc = useQueryClient();
  const isDur = s.type === "durationSeconds";
  const [unit, setUnit] = useState(() => {
    const v = Number(s.value);
    if (!isDur) return 1;
    if (v >= 86400 && v % 86400 === 0) return 86400;
    if (v >= 3600 && v % 3600 === 0) return 3600;
    if (v >= 60 && v % 60 === 0) return 60;
    return 1;
  });
  const [draft, setDraft] = useState<string>(() => (s.type === "bool" ? String(s.value) : isDur ? String(Number(s.value) / unit) : typeof s.value === "string" ? s.value : JSON.stringify(s.value)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(raw: unknown) {
    setBusy(true);
    try {
      const r = await put<Setting>(`/admin/settings/${s.key}`, { value: raw, reason: reason || null });
      qc.setQueryData<Setting[]>(["settings"], (old) => old?.map((x) => (x.key === s.key ? r : x)));
      toast.success(`Đã lưu “${s.name || s.key}”`);
      setReason("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const parsed = (): unknown => {
    if (s.type === "bool") return draft === "true";
    if (["int", "long"].includes(s.type)) return Math.round(Number(draft));
    if (s.type === "double") return Number(draft);
    if (isDur) return Math.round(Number(draft) * unit);
    if (s.type === "text") return draft;
    try {
      return JSON.parse(draft);
    } catch {
      return draft;
    }
  };

  return (
    <div className="grid gap-2 border-b py-3 last:border-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{s.name || s.key}</span>
          <code className="text-xs text-muted-foreground">{s.key}</code>
          {HIGHLIGHT.has(s.key) && (
            <ToneBadge tone="warning">
              <Zap className="size-3" /> tự duyệt / phí
            </ToneBadge>
          )}
          {s.effect === "restart" && <ToneBadge tone="muted">cần khởi động lại service</ToneBadge>}
        </div>
        <p className="text-sm text-muted-foreground">{s.description}</p>
        <p className="text-xs text-muted-foreground">
          Mặc định {show(s.defaultValue, s)}
          {s.min !== null && ` · tối thiểu ${s.min}`}
          {s.max !== null && ` · tối đa ${s.max}`} {s.unit && `· ${s.unit}`} · v{s.version}
          {s.updatedAt && ` · sửa ${formatDateTime(s.updatedAt)}`}
        </p>
      </div>
      <div className="flex items-start gap-1.5">
        <div className="flex-1 space-y-1.5">
          {s.type === "bool" ? (
            <Switch checked={draft === "true"} onCheckedChange={(v) => setDraft(String(v))} />
          ) : s.choices ? (
            <Select value={draft} onValueChange={setDraft}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {s.choices.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : s.type === "text" ? (
            <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : isDur ? (
            <div className="flex gap-1.5">
              <Input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Select value={String(unit)} onValueChange={(v) => { setDraft(String((Number(draft) * unit) / Number(v))); setUnit(Number(v)); }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">giây</SelectItem>
                  <SelectItem value="60">phút</SelectItem>
                  <SelectItem value="3600">giờ</SelectItem>
                  <SelectItem value="86400">ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input type={["int", "long", "double"].includes(s.type) ? "number" : "text"} value={draft} onChange={(e) => setDraft(e.target.value)} />
          )}
          <Input className="h-7 text-xs" placeholder="Lý do thay đổi (ghi vào lịch sử)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button size="icon-sm" onClick={() => void save(parsed())} disabled={busy} aria-label="Lưu">
          <Save />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => void save(s.defaultValue)} disabled={busy} aria-label="Về mặc định" title="Về mặc định">
          <RotateCcw />
        </Button>
        <HistoryButton k={s.key} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<Setting[]>("/admin/settings") });
  const [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, Setting[]>();
    for (const s of q.data ?? []) {
      if (search && !`${s.name} ${s.key} ${s.description}`.toLowerCase().includes(search.toLowerCase())) continue;
      m.set(s.group, (m.get(s.group) ?? []).concat([s]));
    }
    return Array.from(m.entries());
  }, [q.data, search]);

  return (
    <>
      <PageHeader
        title="Cài đặt hệ thống"
        description="Mọi con số nghiệp vụ sửa được lúc đang chạy; có hiệu lực cho thao tác mới."
        actions={
          <div className="relative">
            <Search className="absolute top-2 left-2 size-4 text-muted-foreground" />
            <Input className="w-72 pl-8" placeholder="Tìm theo khoá / mô tả" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      <QueryState query={q}>
        {() => (
          <div className="space-y-6">
            {groups.map(([g, list]) => (
              <Card key={g}>
                <CardHeader>
                  <CardTitle>{g}</CardTitle>
                </CardHeader>
                <CardContent>
                  {list.map((s) => (
                    <Row key={`${s.key}-${s.version}`} s={s} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
