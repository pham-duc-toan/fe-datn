"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workspace } from "@/components/labeling/workspace";
import { DEMO_SAMPLES } from "@/components/tutorial/demo-samples";
import { formatVnd } from "@/lib/format";
import type { LabelData, LabelSchema, Project, ProjectListItem, Visibility } from "@/lib/types";
import { MarketCard } from "./market-card";
import { toolsMissingQuestion } from "@/lib/types";

/** Cấu hình ĐANG SOẠN (chưa cần lưu) — xem trước phản ánh ngay khi người tạo gõ. */
export type PreviewDraft = {
  name: string;
  description: string;
  visibility: Visibility;
  schema: LabelSchema;
  rewardVnd: number;
  slots: number;
  passThresholdPercent: number;
  deadline: string | null;
  allowProfessional: boolean;
  requireEntranceTest: boolean;
  sensitiveContent: boolean;
  requireVerifiedIdentity: boolean;
  ndaRequired: boolean;
  domains: string[];
  languages: string[];
  escrowVnd: number;
};

/**
 * "Labeler sẽ thấy": thẻ dự án ở chợ + một câu trong bài (câu ví dụ theo loại dữ liệu, gán thử được) dựng từ
 * cấu hình đang soạn. Mở ở khung bên cạnh để vừa sửa vừa xem.
 */
export function LabelerPreview({ project: p, draft: d }: { project: Project; draft: PreviewDraft }) {
  const [value, setValue] = useState<LabelData>({});
  const demo = DEMO_SAMPLES[p.modality];
  const card: ProjectListItem = {
    id: p.id,
    name: d.name.trim() || "(chưa đặt tên)",
    modality: p.modality,
    status: "running",
    visibility: d.visibility,
    rewardVnd: d.rewardVnd,
    slots: d.slots,
    passThresholdPercent: d.passThresholdPercent,
    questionCount: p.questionCount,
    toolKinds: Array.from(new Set(d.schema.tools.map((t) => t.kind))),
    deadline: d.deadline,
    requireEntranceTest: d.requireEntranceTest,
    isOwner: false,
    sensitiveContent: d.sensitiveContent,
    consentRequired: d.sensitiveContent || d.ndaRequired,
    requireVerifiedIdentity: d.requireVerifiedIdentity,
    domains: d.domains,
    languages: d.languages,
  };
  const thieuCauHoi = toolsMissingQuestion(d.schema);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" data-tour="cfg-xem-truoc">
          <Eye /> Xem như labeler
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Labeler sẽ thấy</SheetTitle>
          <SheetDescription>Dựng từ cấu hình bạn đang soạn — chưa lưu cũng xem được. Sửa ở trang bên dưới, mở lại để xem bản mới.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Tabs defaultValue="cau">
            <TabsList>
              <TabsTrigger value="cau">Một câu trong bài</TabsTrigger>
              <TabsTrigger value="cho">Thẻ ở chợ dự án</TabsTrigger>
            </TabsList>
            <TabsContent value="cau" className="mt-3 space-y-3">
              {thieuCauHoi.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Còn {thieuCauHoi.length} công cụ chưa có câu hỏi — labeler sẽ không biết dùng công cụ đó để trả lời gì. Dự án chưa publish được cho tới khi đặt đủ.
                  </AlertDescription>
                </Alert>
              )}
              {d.schema.tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Thêm ít nhất một công cụ ở thẻ “Công cụ gán nhãn” để xem trước.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Mẫu minh hoạ — ở bài thật là mẫu của bạn. Câu hỏi hiện ngay trên từng công cụ; mẫu có ngữ cảnh riêng (đặt ở tab Dữ liệu) thì hiện thêm ở đầu câu. Bạn có thể gán thử, không lưu gì.
                  </p>
                  <div className="rounded-lg border border-dashed p-3">
                    <Workspace
                      schema={d.schema}
                      modality={p.modality}
                      fileUrl={demo.fileUrl}
                      content={demo.content}
                      question={null}
                      metadata={demo.metadata}
                      value={value}
                      onChange={setValue}
                      seed="xem-truoc"
                      stacked
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Đầu trang làm bài: “Thưởng {formatVnd(d.rewardVnd)} nếu đạt · giống đa số ≥ {d.passThresholdPercent}% và không sai câu kiểm tra”, kèm đồng hồ hạn nộp.
                  </p>
                </>
              )}
            </TabsContent>
            <TabsContent value="cho" className="mt-3 space-y-3">
              {d.visibility === "private" && (
                <Alert>
                  <AlertDescription>Dự án riêng tư không hiện ở chợ — chỉ người được mời / có mã mời thấy thẻ này.</AlertDescription>
                </Alert>
              )}
              {!d.allowProfessional && (
                <Alert>
                  <AlertDescription>Chưa bật kênh chuyên nghiệp — dự án không hiện ở chợ dự án.</AlertDescription>
                </Alert>
              )}
              <div className="max-w-sm">
                <MarketCard p={card} linked={false} />
              </div>
              <p className="text-xs text-muted-foreground">Ký quỹ giữ lúc publish (labeler không thấy): {formatVnd(d.escrowVnd)}.</p>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
