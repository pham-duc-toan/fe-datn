"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { KeyValue, Markdown } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api, post } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, TOOL_LABEL, VISIBILITY_LABEL } from "@/lib/labels";
import type { Project } from "@/lib/types";

export default function AdminProjectsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending-projects"], queryFn: () => api<Project[]>("/projects/pending-approval"), refetchInterval: 20000 });
  const done = () => void qc.invalidateQueries({ queryKey: ["pending-projects"] });
  return (
    <>
      <PageHeader title="Dự án chờ duyệt" description="Đã giữ ký quỹ. Từ chối thì huỷ dự án và hoàn tiền; quá hạn không ai duyệt cũng tự huỷ." />
      <QueryState query={q} empty={(d) => d.length === 0}>
        {(d) => (
          <div className="space-y-4">
            {d.map((p) => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      <Link href={`/du-an/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {MODALITY_LABEL[p.modality]} · {VISIBILITY_LABEL[p.visibility]} · chủ <UserName id={p.ownerId} />
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          await post(`/projects/${p.id}/approve`);
                          toast.success("Đã duyệt — dự án bắt đầu chạy");
                          done();
                        } catch (e) {
                          toast.error(errorMessage(e));
                        }
                      }}
                    >
                      <Check /> Duyệt
                    </Button>
                    <ActionDialog
                      trigger={<Button variant="destructive"><X /> Từ chối</Button>}
                      title="Từ chối dự án"
                      description="Dự án bị huỷ, ký quỹ hoàn về doanh nghiệp."
                      destructive
                      fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
                      onConfirm={async (v) => {
                        await post(`/projects/${p.id}/reject`, { reason: v.reason });
                        done();
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <KeyValue
                      className="sm:grid-cols-1"
                      items={[
                        ["Thưởng / suất", `${formatVnd(p.rewardVnd)} × ${p.slots} suất`],
                        ["Bài", `${p.questionCount} câu · đạt khi giống đa số ≥ ${p.passThresholdPercent}%`],
                        ["Ký quỹ", formatVnd(p.escrowVnd)],
                        ["Hạn chót", formatDateTime(p.deadline)],
                        ["Kênh", [p.allowProfessional && "chuyên nghiệp", p.allowLinkGateway && "cổng link"].filter(Boolean).join(", ")],
                        ["Nhạy cảm / NDA", `${p.sensitiveContent ? "Có" : "Không"} / ${p.ndaRequired ? "Có" : "Không"}`],
                      ]}
                    />
                    <div className="text-sm">
                      <p className="font-medium">Công cụ</p>
                      <ul className="list-disc pl-5">
                        {(p.labelSchema?.tools ?? []).map((t) => (
                          <li key={t.name}>
                            {t.name} — {TOOL_LABEL[t.kind]} {t.classes && `(${t.classes.join(", ")})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-md border p-3">
                    {p.description && <p className="mb-2 text-sm whitespace-pre-wrap">{p.description}</p>}
                    {p.guideline?.markdown ? <Markdown>{p.guideline.markdown}</Markdown> : <p className="text-sm text-muted-foreground">Không có hướng dẫn.</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
