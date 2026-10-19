"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCode, FileText, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { api, downloadFile, openHtml, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";

type Item = { projectId: string | null; description: string; quantity: number; netVnd: number; vatVnd: number; totalVnd: number };
type Preview = { period: string; vatPercent: number; items: Item[]; totalNetVnd: number; totalVatVnd: number; totalVnd: number; passThroughVnd: number; issued: boolean };
type Invoice = { invoiceId: string; period: string; serial: string; number: string; issuedAt: string; totalNetVnd: number; totalVatVnd: number; totalVnd: number; vatPercent: number };

function thisMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(thisMonth(0));
  const preview = useQuery({ queryKey: ["invoice-preview", period], queryFn: () => api<Preview>("/ledger/invoices/preview", { query: { period } }) });
  const list = useQuery({ queryKey: ["invoices"], queryFn: () => api<Invoice[]>("/ledger/invoices") });
  const [busy, setBusy] = useState(false);
  const isPast = period < thisMonth(0);

  return (
    <>
      <PageHeader title="Hoá đơn VAT phí nền tảng" description="Phí nền tảng đã thu là giá gồm thuế; hoá đơn tách tiền hàng + VAT. Đầu tháng hệ thống tự xuất hoá đơn tháng trước." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-end justify-between gap-3">
            <div>
              <CardTitle>Tạm tính theo tháng</CardTitle>
              <CardDescription>Xem trước, không lưu.</CardDescription>
            </div>
            <Field label="Kỳ">
              <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
          </CardHeader>
          <CardContent>
            <QueryState query={preview}>
              {(p) => (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nội dung</TableHead>
                        <TableHead className="text-right">SL</TableHead>
                        <TableHead className="text-right">Tiền hàng</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.items.map((i, k) => (
                        <TableRow key={k}>
                          <TableCell className="text-sm">{i.description}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatVnd(i.netVnd)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatVnd(i.vatVnd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="space-y-1 text-sm">
                    <p>Tiền hàng: <b>{formatVnd(p.totalNetVnd)}</b> · VAT {p.vatPercent}%: <b>{formatVnd(p.totalVatVnd)}</b> · Tổng: <b>{formatVnd(p.totalVnd)}</b></p>
                    <p className="text-muted-foreground">Chi hộ (thù lao labeler, không chịu VAT): {formatVnd(p.passThroughVnd)}</p>
                  </div>
                  {isPast && !p.issued && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await post("/ledger/invoices", { period });
                          toast.success("Đã xuất hoá đơn");
                          await qc.invalidateQueries({ queryKey: ["invoices"] });
                          await qc.invalidateQueries({ queryKey: ["invoice-preview", period] });
                        } catch (e) {
                          toast.error(errorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? <Loader2 className="animate-spin" /> : <Receipt />} Xuất hoá đơn kỳ {period}
                    </Button>
                  )}
                  {p.issued && <p className="text-sm text-emerald-700">Kỳ này đã có hoá đơn.</p>}
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hoá đơn đã xuất</CardTitle>
            <CardDescription>Không sửa / xoá được.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState query={list} empty={(d) => d.length === 0}>
              {(d) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Số</TableHead>
                      <TableHead>Kỳ</TableHead>
                      <TableHead className="text-right">Tổng</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.map((i) => (
                      <TableRow key={i.invoiceId}>
                        <TableCell>
                          <div className="font-medium">
                            {i.serial} · {i.number}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(i.issuedAt)}</div>
                        </TableCell>
                        <TableCell>{i.period}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(i.totalVnd)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="xs" variant="outline" onClick={() => void openHtml(`/ledger/invoices/${i.invoiceId}/html`).catch((e) => toast.error(errorMessage(e)))}>
                              <FileText /> In
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => void downloadFile(`/ledger/invoices/${i.invoiceId}/xml`, undefined, `hoa-don-${i.number}.xml`).catch((e) => toast.error(errorMessage(e)))}>
                              <FileCode /> XML
                            </Button>
                          </div>
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
    </>
  );
}
