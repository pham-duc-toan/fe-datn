"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Field, StatCard } from "@/components/common/misc";
import { api } from "@/lib/api";
import { daysAgo, formatNumber, formatVnd, isoDay, shortId } from "@/lib/format";
import { GATE_OUTCOME } from "@/lib/labels";

type Daily = { date: string; views: number; submits: number; paidClicks: number; estimatedRevenueVnd: number };
type Group = { key: string; views: number; paidClicks: number; estimatedRevenueVnd: number };

function GroupTable({ title, rows, label }: { title: string; rows: Group[]; label: (k: string) => string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mục</TableHead>
              <TableHead className="text-right">Xem</TableHead>
              <TableHead className="text-right">Tính tiền</TableHead>
              <TableHead className="text-right">Doanh thu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="max-w-48 truncate">{label(r.key)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.paidClicks)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(r.estimatedRevenueVnd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function GateStatsPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const daily = useQuery({ queryKey: ["gate-daily", from, to], queryFn: () => api<Daily[]>("/gate/stats/me/daily", { query: { from, to } }) });
  const top = useQuery({ queryKey: ["gate-top"], queryFn: () => api<Group[]>("/gate/stats/me/top-links", { query: { limit: 10 } }) });
  const sources = useQuery({ queryKey: ["gate-sources"], queryFn: () => api<Group[]>("/gate/stats/me/sources") });
  const outcomes = useQuery({ queryKey: ["gate-outcomes"], queryFn: () => api<Group[]>("/gate/stats/me/outcomes") });
  const d = daily.data ?? [];
  const sum = (k: keyof Daily) => d.reduce((a, x) => a + (x[k] as number), 0);

  return (
    <>
      <PageHeader
        title="Thống kê cổng link"
        description="Doanh thu là ước tính (trễ 1–2 giây); số chính thức ở ví."
        actions={
          <div className="flex items-end gap-2">
            <Field label="Từ">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Đến">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lượt xem" value={formatNumber(sum("views"))} />
        <StatCard label="Lượt nộp" value={formatNumber(sum("submits"))} />
        <StatCard label="Lượt tính tiền" value={formatNumber(sum("paidClicks"))} />
        <StatCard label="Doanh thu ước tính" value={formatVnd(sum("estimatedRevenueVnd"))} />
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Theo ngày</CardTitle>
          <CardDescription>Lượt chỉ sinh tiền khi đạt câu vàng, không phải chính chủ, không trùng IP trong 24 giờ, và dự án còn ngân sách cổng.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.map((x) => ({ ...x, day: x.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="views" name="Xem" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
              <Area type="monotone" dataKey="paidClicks" name="Tính tiền" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <GroupTable title="Link nổi bật" rows={top.data ?? []} label={(k) => shortId(k)} />
        <GroupTable title="Nguồn truy cập" rows={sources.data ?? []} label={(k) => k || "(truy cập trực tiếp)"} />
        <GroupTable title="Kết cục lượt vượt" rows={outcomes.data ?? []} label={(k) => GATE_OUTCOME[k] ?? k} />
      </div>
    </>
  );
}
