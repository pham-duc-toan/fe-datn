"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, Loading } from "@/components/common/states";
import { useProject } from "@/components/project/use-project";
import { OverviewTab } from "@/components/project/overview-tab";
import { ConfigTab } from "@/components/project/config-tab";
import { DataTab } from "@/components/project/data-tab";
import { GoldTab } from "@/components/project/gold-tab";
import { MembersTab } from "@/components/project/members-tab";
import { ResultsTab } from "@/components/project/results-tab";
import { QualityTab } from "@/components/project/quality-tab";
import { ReportsTab } from "@/components/project/reports-tab";
import { MODALITY_LABEL, projectStatus, VISIBILITY_LABEL } from "@/lib/labels";

const TABS = [
  ["tong-quan", "Tổng quan"],
  ["cau-hinh", "Cấu hình"],
  ["du-lieu", "Dữ liệu"],
  ["cau-vang", "Câu vàng"],
  ["thanh-vien", "Thành viên"],
  ["ket-qua", "Kết quả"],
  ["chat-luong", "Chất lượng"],
  ["bao-loi", "Câu bị báo lỗi"],
] as const;

/** Chỉ có dữ liệu sau khi dự án được duyệt (đã chạy) — trước đó ẩn đi. */
const AFTER_APPROVAL = new Set(["ket-qua", "chat-luong", "bao-loi"]);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const q = useProject(id);

  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data!;
  const setTab = (t: string) => router.replace(`/du-an/${id}?tab=${t}`, { scroll: false });
  // Đã được admin duyệt (publishedAt có từ lúc duyệt) — mới có bài nộp, chất lượng, câu bị báo lỗi.
  const approved = Boolean(p.publishedAt) || ["running", "paused", "grading", "completed"].includes(p.status);
  const tabs = TABS.filter(([k]) => approved || !AFTER_APPROVAL.has(k));
  const asked = params.get("tab") ?? "tong-quan";
  const tab = tabs.some(([k]) => k === asked) ? asked : "tong-quan";

  return (
    <>
      <PageHeader
        back={{ href: "/du-an", label: "Dự án của tôi" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name} <StatusBadge entry={projectStatus(p.status)} />
          </span>
        }
        description={`${MODALITY_LABEL[p.modality]} · ${VISIBILITY_LABEL[p.visibility]}${p.description ? ` · ${p.description}` : ""}`}
        actions={
          approved && (
            <Button variant="outline" onClick={() => setTab("ket-qua")}>
              <ClipboardCheck /> Xem kết quả
            </Button>
          )
        }
      />
      {!p.isOwner ? (
        <p className="text-sm text-muted-foreground">
          Bạn không phải chủ dự án này. <Link href={`/cho/${p.id}`} className="text-primary underline">Mở trang dự án</Link>.
        </p>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap">
            {tabs.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-5">
            <TabsContent value="tong-quan">
              <OverviewTab project={p} onTab={setTab} />
            </TabsContent>
            <TabsContent value="cau-hinh">
              <ConfigTab project={p} />
            </TabsContent>
            <TabsContent value="du-lieu">
              <DataTab project={p} />
            </TabsContent>
            <TabsContent value="cau-vang">
              <GoldTab project={p} />
            </TabsContent>
            <TabsContent value="thanh-vien">
              <MembersTab project={p} />
            </TabsContent>
            {approved && (
              <>
                <TabsContent value="ket-qua">
                  <ResultsTab project={p} />
                </TabsContent>
                <TabsContent value="chat-luong">
                  <QualityTab project={p} />
                </TabsContent>
                <TabsContent value="bao-loi">
                  <ReportsTab project={p} />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      )}
    </>
  );
}
