"use client";

import { useQuery } from "@tanstack/react-query";
import { FileCode, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { api, downloadFile, openHtml } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import type { Paged } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

type Inv = { invoiceId: string; period: string; serial: string; number: string; issuedAt: string; buyerName: string; buyerTaxCode: string; totalVnd: number; totalVatVnd: number };

export default function AdminInvoicesPage() {
  const [period, setPeriod] = useUrlState("period", "");
  const [page, setPage] = useUrlPage();
  const q = useQuery({ queryKey: ["admin-invoices", period, page], queryFn: () => api<Paged<Inv>>("/ledger/invoices/admin", { query: { period: period || undefined, page, pageSize: 20 } }) });
  return (
    <>
      <PageHeader title="Hoá đơn VAT" description="Mọi hoá đơn phí nền tảng đã xuất." actions={<Input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} className="w-44" />} />
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Số</TableHead>
                      <TableHead>Người mua</TableHead>
                      <TableHead>Kỳ</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">Tổng</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((i) => (
                      <TableRow key={i.invoiceId}>
                        <TableCell className="pl-4">
                          {i.serial} · {i.number}
                          <div className="text-xs text-muted-foreground">{formatDateTime(i.issuedAt)}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {i.buyerName}
                          <div className="text-xs text-muted-foreground">MST {i.buyerTaxCode}</div>
                        </TableCell>
                        <TableCell>{i.period}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(i.totalVatVnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(i.totalVnd)}</TableCell>
                        <TableCell>
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
