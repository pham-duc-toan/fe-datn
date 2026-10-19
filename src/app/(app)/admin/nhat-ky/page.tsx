"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { JsonView } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api } from "@/lib/api";
import { formatDateTime, shortId } from "@/lib/format";
import type { Paged } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

type Ev = { eventId: string; eventType: string; producer: string; occurredAt: string; correlationId: string; causationId: string | null; actorId: string | null; actorRole: string | null; payload: unknown };

export default function AuditPage() {
  const [form, setForm] = useState({ eventType: "", actorId: "", correlationId: "", from: "", to: "" });
  const [filter, setFilter] = useState(form);
  const [page, setPage] = useUrlPage();
  const [open, setOpen] = useState<string | null>(null);
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
  return (
    <>
      <PageHeader title="Nhật ký audit" description="Chỉ ghi thêm, không sửa / xoá được ở mức CSDL. Lọc theo correlationId để xem một thao tác kéo theo những gì." />
      <form
        className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(form);
          setPage(1);
        }}
      >
        <Input placeholder="eventType, vd project.published" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} />
        <Input placeholder="actorId" value={form.actorId} onChange={(e) => setForm({ ...form, actorId: e.target.value })} />
        <Input placeholder="correlationId" value={form.correlationId} onChange={(e) => setForm({ ...form, correlationId: e.target.value })} />
        <Input type="datetime-local" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        <Input type="datetime-local" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        <Button type="submit" variant="outline">
          <Search /> Lọc
        </Button>
      </form>
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Lúc</TableHead>
                      <TableHead>Sự kiện</TableHead>
                      <TableHead>Nguồn</TableHead>
                      <TableHead>Người làm</TableHead>
                      <TableHead>Correlation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((e) => (
                      <Fragment key={e.eventId}>
                        <TableRow className="cursor-pointer" onClick={() => setOpen(open === e.eventId ? null : e.eventId)}>
                          <TableCell className="pl-4 whitespace-nowrap">{formatDateTime(e.occurredAt)}</TableCell>
                          <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                          <TableCell className="text-xs">{e.producer}</TableCell>
                          <TableCell className="text-sm">
                            {e.actorId ? <UserName id={e.actorId} /> : "hệ thống"} {e.actorRole && <span className="text-xs text-muted-foreground">({e.actorRole})</span>}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="font-mono text-xs text-primary hover:underline"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const f = { ...form, correlationId: e.correlationId };
                                setForm(f);
                                setFilter(f);
                                setPage(1);
                              }}
                            >
                              {shortId(e.correlationId)}
                            </button>
                          </TableCell>
                        </TableRow>
                        {open === e.eventId && (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <JsonView value={e.payload} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
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
