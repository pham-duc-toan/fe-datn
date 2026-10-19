"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api, del, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";

type Entry = { labelerId: string; kind: "preferred" | "blocked"; note: string | null; createdAt: string; updatedAt: string; affectedProjects: number | null };

function RatingSummary({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["rating-summary", id], queryFn: () => api<{ average: number | null; count: number }>(`/projects/labelers/${id}/rating-summary`) });
  if (!q.data || q.data.count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      ★ {formatNumber(q.data.average, 1)} ({q.data.count})
    </span>
  );
}

export default function LabelerListsPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"preferred" | "blocked">("preferred");
  const q = useQuery({ queryKey: ["labeler-lists", kind], queryFn: () => api<Entry[]>("/projects/labeler-lists", { query: { kind } }) });
  return (
    <>
      <PageHeader
        title="Danh sách labeler"
        description="Ưu tiên: được duyệt đơn tự động, mời cả danh sách vào dự án một lần. Chặn: không vào được mọi dự án của bạn."
        actions={
          <ActionDialog
            trigger={<Button><Plus /> Thêm</Button>}
            title="Thêm labeler vào danh sách"
            fields={[
              { name: "labelerId", label: "userId của labeler", required: true },
              { name: "kind", label: "Danh sách", type: "select", defaultValue: kind, options: [{ value: "preferred", label: "Ưu tiên" }, { value: "blocked", label: "Chặn" }] },
              { name: "note", label: "Ghi chú" },
            ]}
            onConfirm={async (v) => {
              await put(`/projects/labeler-lists/${String(v.labelerId).trim()}`, { kind: v.kind, note: v.note || null });
              toast.success("Đã cập nhật danh sách");
              await qc.invalidateQueries({ queryKey: ["labeler-lists"] });
            }}
          />
        }
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="mb-4">
        <TabsList>
          <TabsTrigger value="preferred">Ưu tiên</TabsTrigger>
          <TabsTrigger value="blocked">Chặn</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardHeader>
          <CardTitle>{kind === "preferred" ? "Labeler ưu tiên" : "Labeler bị chặn"}</CardTitle>
          <CardDescription>Đánh giá trung bình từ mọi doanh nghiệp.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={q} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Labeler</TableHead>
                    <TableHead>Đánh giá</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((e) => (
                    <TableRow key={e.labelerId}>
                      <TableCell>
                        <UserName id={e.labelerId} withAvatar />
                      </TableCell>
                      <TableCell>
                        <RatingSummary id={e.labelerId} />
                      </TableCell>
                      <TableCell>{e.note ?? ""}</TableCell>
                      <TableCell>{formatDateTime(e.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await del(`/projects/labeler-lists/${e.labelerId}`);
                              await qc.invalidateQueries({ queryKey: ["labeler-lists"] });
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </>
  );
}
