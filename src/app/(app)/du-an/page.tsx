"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { api } from "@/lib/api";
import { formatDate, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, PROJECT_STATUS, projectStatus, VISIBILITY_LABEL } from "@/lib/labels";
import type { Paged, ProjectListItem } from "@/lib/types";
import { useUrlPage, useUrlState } from "@/lib/use-url-state";

export default function MyProjectsPage() {
  const [page, setPage] = useUrlPage();
  const [status, setStatus] = useUrlState("status", "all");
  const q = useQuery({
    queryKey: ["projects", "mine", page, status],
    queryFn: () => api<Paged<ProjectListItem>>("/projects", { query: { mine: true, page, pageSize: 20, status: status === "all" ? undefined : status } }),
  });
  return (
    <>
      <PageHeader
        title="Dự án của tôi"
        description="Dự án bạn sở hữu và dự án bạn được mời làm người duyệt."
        actions={
          <>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/du-an/moi">
                <PlusCircle /> Tạo dự án
              </Link>
            </Button>
          </>
        }
      />
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Tên dự án</TableHead>
                      <TableHead>Loại dữ liệu</TableHead>
                      <TableHead>Chế độ</TableHead>
                      <TableHead className="text-right">Thưởng / suất</TableHead>
                      <TableHead>Hạn chót</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.items.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <Link href={p.isOwner ? `/du-an/${p.id}` : `/cho/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {p.questionCount} câu · {p.slots} suất · đạt ≥ {p.passThresholdPercent}%
                          </div>
                        </TableCell>
                        <TableCell>{MODALITY_LABEL[p.modality]}</TableCell>
                        <TableCell>{VISIBILITY_LABEL[p.visibility]}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(p.rewardVnd)}</TableCell>
                        <TableCell>{formatDate(p.deadline)}</TableCell>
                        <TableCell>
                          <StatusBadge entry={projectStatus(p.status)} />
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
