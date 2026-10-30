"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton, Field, StatCard } from "@/components/common/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { useAuth } from "@/components/providers/auth-provider";
import { api, newIdempotencyKey, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { daysAgo, formatDateTime, formatVnd, isoDay } from "@/lib/format";
import { depositStatus, EARNING_KIND, PROVIDER_LABEL, withdrawalState } from "@/lib/labels";
import type { Balance, Deposit, Paged, Transaction, Withdrawal } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

function DepositForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api<{ providers: string[] }>("/payments/deposits/providers") });
  const [amount, setAmount] = useState("500000");
  const [provider, setProvider] = useState<string>("");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Deposit | null>(null);
  const list = providers.data?.providers ?? [];
  const chosen = provider || list.find((p) => p !== "manual_transfer") || list[0] || "";

  // Lệnh đang theo dõi: cổng thử nghiệm mở tab riêng, chuyển khoản chờ admin — hỏi lại trạng thái.
  useEffect(() => {
    if (!intent || ["succeeded", "failed", "rejected", "expired"].includes(intent.status)) return;
    const h = setInterval(async () => {
      try {
        const d = await api<Deposit>(`/payments/deposits/${intent.intentId}`);
        setIntent(d);
        if (d.status === "succeeded") {
          toast.success("Nạp tiền thành công");
          setTimeout(() => qc.invalidateQueries({ queryKey: ["balance"] }), 1500);
        }
      } catch {
        /* thử lại vòng sau */
      }
    }, intent.provider === "manual_transfer" ? 15000 : 3000);
    return () => clearInterval(h);
  }, [intent, qc]);

  async function submit() {
    setBusy(true);
    try {
      const amountVnd = Math.round(Number(amount));
      const d =
        chosen === "manual_transfer"
          ? await post<Deposit>("/payments/deposits/manual", { amountVnd }, { idempotencyKey: key })
          : await post<Deposit>("/payments/deposits", { amountVnd, provider: chosen }, { idempotencyKey: key });
      setIntent(d);
      setKey(newIdempotencyKey());
      if (d.checkoutUrl) {
        if (chosen === "vnpay" || chosen === "momo") {
          sessionStorage.setItem("crowd.depositIntent", d.intentId);
          window.location.href = d.checkoutUrl;
        } else window.open(d.checkoutUrl, "_blank", "noopener");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nạp tiền vào ví doanh nghiệp</CardTitle>
          <CardDescription>Tiền nạp dùng để ký quỹ dự án. Hạn mức mặc định 10.000 – 500.000.000đ mỗi lần.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Số tiền (đồng)">
            <Input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[200000, 500000, 1000000, 5000000].map((v) => (
              <Button key={v} type="button" size="xs" variant="outline" onClick={() => setAmount(String(v))}>
                {formatVnd(v)}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Phương thức</span>
            <RadioGroup value={chosen} onValueChange={setProvider} className="grid gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <label key={p} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                  <RadioGroupItem value={p} /> {PROVIDER_LABEL[p] ?? p}
                </label>
              ))}
            </RadioGroup>
          </div>
          <Button onClick={() => void submit()} disabled={busy || !chosen || !Number(amount)}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />} Nạp {formatVnd(Number(amount) || 0)}
          </Button>
        </CardContent>
      </Card>
      {intent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Lệnh nạp <StatusBadge entry={depositStatus(intent.status)} />
            </CardTitle>
            <CardDescription>
              {PROVIDER_LABEL[intent.provider] ?? intent.provider} · {formatVnd(intent.amountVnd)} · tạo {formatDateTime(intent.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {intent.provider === "manual_transfer" ? (
              <>
                <Alert>
                  <Banknote />
                  <AlertTitle>Chuyển khoản theo thông tin dưới đây</AlertTitle>
                  <AlertDescription>
                    <p className="whitespace-pre-wrap">{intent.bankInfo}</p>
                    <p className="mt-2">
                      Nội dung chuyển khoản <b>bắt buộc</b>: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{intent.transferCode}</code>{" "}
                      {intent.transferCode && <CopyButton value={intent.transferCode} size="xs" label="Sao chép" />}
                    </p>
                  </AlertDescription>
                </Alert>
                {intent.status === "pending" && (
                  <Button
                    onClick={async () => {
                      try {
                        setIntent(await post<Deposit>(`/payments/deposits/${intent.intentId}/transferred`));
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Tôi đã chuyển khoản
                  </Button>
                )}
                {intent.status === "awaitingApproval" && <p className="text-muted-foreground">Admin đang đối chiếu sao kê, có thể mất vài giờ. Bạn có thể rời trang.</p>}
              </>
            ) : intent.status === "pending" ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">Đang chờ cổng thanh toán xác nhận…</p>
                <div className="flex gap-2">
                  {intent.checkoutUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(intent.checkoutUrl!, "_blank", "noopener")}>
                      Mở lại trang thanh toán
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => router.push(`/nap-tien/ket-qua?intent=${intent.intentId}`)}>
                    <RefreshCw /> Kiểm tra trạng thái
                  </Button>
                </div>
              </div>
            ) : null}
            {intent.rejectReason && <p className="text-destructive">Lý do: {intent.rejectReason}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WithdrawPanel({ available }: { available: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["withdrawals"], queryFn: () => api<Withdrawal[]>("/ledger/withdrawals/mine"), refetchInterval: 10000 });

  async function submit() {
    setBusy(true);
    try {
      const w = await post<Withdrawal>("/ledger/withdrawals", { amountVnd: Math.round(Number(amount)), bankAccount: bank.trim() }, { idempotencyKey: key });
      toast.success(`Đã tạo lệnh rút ${formatVnd(w.amountVnd)} — thực nhận ${formatVnd(w.netVnd)}`);
      setKey(newIdempotencyKey());
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["withdrawals"] });
      await qc.invalidateQueries({ queryKey: ["balance"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Rút tiền</CardTitle>
          <CardDescription>Khả dụng: {formatVnd(available)}. Mức tối thiểu và thuế khấu trừ do hệ thống tính.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Số tiền (đồng)">
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Tài khoản nhận" hint="Ngân hàng – số tài khoản – chủ tài khoản">
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="VCB 0123456789 NGUYEN VAN A" />
          </Field>
          <Button onClick={() => void submit()} disabled={busy || !Number(amount) || !bank.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />} Rút tiền
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lệnh rút của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState query={list} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead className="text-right">Thuế</TableHead>
                    <TableHead className="text-right">Thực nhận</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{formatDateTime(w.createdAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatVnd(w.amountVnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatVnd(w.taxVnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatVnd(w.netVnd)}</TableCell>
                      <TableCell>
                        <StatusBadge entry={withdrawalState(w.state)} />
                        {w.failureReason && <p className="mt-1 text-xs text-destructive">{w.failureReason}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

function Transactions() {
  const [page, setPage] = useUrlPage();
  const q = useQuery({ queryKey: ["transactions", page], queryFn: () => api<Paged<Transaction>>("/ledger/me/transactions", { query: { page, pageSize: 20 } }) });
  return (
    <Card>
      <CardContent>
        <QueryState query={q} empty={(d) => d.items.length === 0}>
          {(d) => (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Tài khoản</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((t) => (
                    <TableRow key={`${t.seq}-${t.accountCode}`}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(t.at)}</TableCell>
                      <TableCell>
                        <div>{t.description}</div>
                        <div className="text-xs text-muted-foreground">{t.type}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.accountCode}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${t.amountVnd < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {t.amountVnd > 0 ? "+" : ""}
                        {formatVnd(t.amountVnd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function Earnings() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const q = useQuery({
    queryKey: ["earnings", from, to],
    queryFn: () => api<{ totalVnd: number; byKindVnd: Record<string, number>; items: { key: string; amountVnd: number; count: number }[] }>("/ledger/me/earnings", { query: { from, to, groupBy: "day" } }),
  });
  // Ngày không có thu nhập không có trong items — điền 0 cho biểu đồ (mục 5.7).
  const series = useMemo(() => {
    const map = new Map((q.data?.items ?? []).map((i) => [i.key, i.amountVnd]));
    const out: { day: string; amount: number }[] = [];
    const d = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (d <= end && out.length < 400) {
      const k = isoDay(d);
      out.push({ day: k.slice(5), amount: map.get(k) ?? 0 });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [q.data, from, to]);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Thu nhập theo ngày</CardTitle>
          <CardDescription>Gồm cả khoản đang treo; không tính khoản bị giữ lại do vi phạm.</CardDescription>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Từ">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Tổng: <b>{formatVnd(q.data?.totalVnd)}</b>
          </span>
          {Object.entries(q.data?.byKindVnd ?? {}).map(([k, v]) => (
            <span key={k} className="text-muted-foreground">
              {EARNING_KIND[k] ?? k}: {formatVnd(v)}
            </span>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v) => formatVnd(Number(v))} labelFormatter={(l) => `Ngày ${l}`} />
              <Bar dataKey="amount" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WalletPage() {
  const { activeRole, roles } = useAuth();
  const bal = useQuery({ queryKey: ["balance"], queryFn: () => api<Balance>("/ledger/me/balance") });
  const isBiz = activeRole === "business";
  // Thu nhập (thù lao nhãn, vượt link, hoa hồng) chỉ có ở labeler; tiền doanh nghiệp nạp không rút ra được.
  const earns = roles.includes("labeler") || roles.includes("sharer");
  const [tab, setTab] = useUrlState("tab", isBiz ? "nap-tien" : "rut-tien");
  const b = bal.data;

  return (
    <>
      <PageHeader title="Ví" description="Số dư, nạp tiền, rút tiền và lịch sử giao dịch." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isBiz || roles.includes("business")) && (
          <>
            <StatCard label="Doanh nghiệp — khả dụng" value={formatVnd(b?.businessAvailableVnd)} />
            <StatCard label="Doanh nghiệp — đang ký quỹ" value={formatVnd(b?.escrowVnd)} />
          </>
        )}
        {earns && (
          <>
            <StatCard label="Thu nhập — đang treo" value={formatVnd(b?.pendingVnd)} hint="Chờ hết hạn khiếu nại / gian lận" />
            <StatCard label="Thu nhập — rút được" value={formatVnd(b?.availableVnd)} />
          </>
        )}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {roles.includes("business") && <TabsTrigger value="nap-tien">Nạp tiền</TabsTrigger>}
          {earns && <TabsTrigger value="rut-tien">Rút tiền</TabsTrigger>}
          {earns && <TabsTrigger value="thu-nhap">Thu nhập</TabsTrigger>}
          <TabsTrigger value="giao-dich">Giao dịch</TabsTrigger>
        </TabsList>
        {roles.includes("business") && (
          <TabsContent value="nap-tien" className="mt-4">
            <DepositForm />
          </TabsContent>
        )}
        {earns && (
          <TabsContent value="rut-tien" className="mt-4">
            <WithdrawPanel available={b?.availableVnd ?? 0} />
          </TabsContent>
        )}
        {earns && (
          <TabsContent value="thu-nhap" className="mt-4">
            <Earnings />
          </TabsContent>
        )}
        <TabsContent value="giao-dich" className="mt-4">
          <Transactions />
        </TabsContent>
      </Tabs>
    </>
  );
}
