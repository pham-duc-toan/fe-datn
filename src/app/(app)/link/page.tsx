"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Link2, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton, Field } from "@/components/common/misc";
import { ActionDialog } from "@/components/common/action-dialog";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { api, post } from "@/lib/api";
import { errorMessage, messageForCode } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { linkStatus, LINK_STATUS } from "@/lib/labels";
import type { Paged, ShortLink } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Campaign = { id: string; name: string; linkCount: number; createdAt: string };

export default function LinksPage() {
  const qc = useQueryClient();
  const [page, setPage] = useUrlPage();
  const [status, setStatus] = useUrlState("status", "all");
  const [campaignId, setCampaignId] = useUrlState("campaign", "all");
  const links = useQuery({
    queryKey: ["links", page, status, campaignId],
    queryFn: () => api<Paged<ShortLink>>("/links", { query: { page, pageSize: 20, status: status === "all" ? undefined : status, campaignId: campaignId === "all" ? undefined : campaignId } }),
    refetchInterval: (q) => ((q.state.data?.items ?? []).some((l) => l.status === "pendingScan") ? 2000 : false),
  });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => api<Campaign[]>("/links/campaigns") });
  const [form, setForm] = useState({ url: "", alias: "", password: "", expiresAt: "", campaignId: "" });
  const [bulk, setBulk] = useState("");
  const [bulkResult, setBulkResult] = useState<{ url: string; link: ShortLink | null; errorCode: string | null; error: string | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["links"] });

  return (
    <>
      <PageHeader
        title="Link của tôi"
        description="Khách mở link giải 1–3 câu gán nhãn nhỏ rồi tới đích; bạn được trả tiền theo lượt vượt hợp lệ vào cùng ví với thu nhập."
        actions={
          <ActionDialog
            trigger={<Button variant="outline"><FolderPlus /> Chiến dịch mới</Button>}
            title="Tạo chiến dịch"
            fields={[{ name: "name", label: "Tên chiến dịch", required: true }]}
            onConfirm={async (v) => {
              await post("/links/campaigns", { name: v.name });
              await qc.invalidateQueries({ queryKey: ["campaigns"] });
            }}
            successMessage="Đã tạo chiến dịch"
          />
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rút gọn link</CardTitle>
          <CardDescription>Link đích không sửa được sau khi tạo. Hệ thống kiểm duyệt link đích vài giây trước khi chạy.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">Một link</TabsTrigger>
              <TabsTrigger value="bulk">Hàng loạt</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="space-y-3 pt-3">
              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <Field label="Link đích" required>
                  <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/bai-viet" />
                </Field>
                <Field label="Alias (tuỳ chọn)" hint="3–32 ký tự A-Z 0-9 _ -">
                  <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
                </Field>
                <Field
                  label="Mật khẩu (tuỳ chọn)"
                  hint={form.password && (form.password.length < 4 || form.password.length > 100) ? undefined : "Từ 4 đến 100 ký tự"}
                  error={form.password && (form.password.length < 4 || form.password.length > 100) ? `Mật khẩu phải từ 4 đến 100 ký tự (đang có ${form.password.length}).` : undefined}
                >
                  <Input type="password" maxLength={100} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Hết hạn">
                    <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                  </Field>
                  <Field label="Chiến dịch">
                    <Select value={form.campaignId || "none"} onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? "" : v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không</SelectItem>
                        {(campaigns.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
              <Button
                disabled={busy || !form.url.trim() || (form.password !== "" && (form.password.length < 4 || form.password.length > 100))}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const l = await post<ShortLink>("/links", {
                      url: form.url.trim(),
                      alias: form.alias.trim() || undefined,
                      password: form.password || undefined,
                      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
                      campaignId: form.campaignId || undefined,
                    });
                    toast.success(`Đã tạo link ${l.code}`);
                    setForm({ url: "", alias: "", password: "", expiresAt: "", campaignId: form.campaignId });
                    void refresh();
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Rút gọn
              </Button>
            </TabsContent>
            <TabsContent value="bulk" className="space-y-3 pt-3">
              <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Mỗi dòng một URL (tối đa 100)" />
              <Button
                disabled={busy || !bulk.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await post<typeof bulkResult>("/links/bulk", { urls: bulk.split("\n").map((u) => u.trim()).filter(Boolean), campaignId: form.campaignId || undefined });
                    setBulkResult(r);
                    void refresh();
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <ListPlus /> Tạo hàng loạt
              </Button>
              {bulkResult && (
                <div className="space-y-1 rounded-md border p-2 text-sm">
                  {bulkResult.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.url}</span>
                      {r.link ? <ToneBadge tone="success">{r.link.code}</ToneBadge> : <ToneBadge tone="danger">{(r.errorCode && messageForCode(r.errorCode)) ?? r.error}</ToneBadge>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            {Object.entries(LINK_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi chiến dịch</SelectItem>
            {(campaigns.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.linkCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={links} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Link</TableHead>
                      <TableHead>Đích</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Tạo lúc</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="pl-4">
                          <Link href={`/link/${l.id}`} className="font-mono font-medium hover:underline">
                            /g/{l.code}
                          </Link>
                          {l.hasPassword && <span className="ml-1 text-xs text-muted-foreground">🔒</span>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={l.destinationUrl}>
                          {l.destinationUrl}
                        </TableCell>
                        <TableCell>
                          <StatusBadge entry={linkStatus(l.status)} />
                          {l.statusReason && <div className="text-xs text-destructive">{l.statusReason}</div>}
                        </TableCell>
                        <TableCell>{formatDateTime(l.createdAt)}</TableCell>
                        <TableCell className="text-right">{l.status === "active" && <CopyButton value={l.shortUrl} size="xs" label="Sao chép" />}</TableCell>
                      </TableRow>
                    ))}
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
