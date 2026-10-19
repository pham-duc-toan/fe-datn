"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, LayoutTemplate, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { api, post, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatVnd } from "@/lib/format";
import { MODALITY_LABEL, TOOL_LABEL, VISIBILITY_LABEL } from "@/lib/labels";
import type { Modality, Project, Template, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIS_HINT: Record<Visibility, string> = {
  public: "Labeler thấy dự án và tự tham gia (hoặc làm đạt bài test).",
  approval: "Labeler thấy dự án nhưng phải gửi đơn, bạn duyệt.",
  private: "Labeler không thấy; chỉ vào khi bạn mời hoặc có mã mời.",
};

export default function NewProjectPage() {
  const router = useRouter();
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/templates") });
  const [tpl, setTpl] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [modality, setModality] = useState<Modality>("image");
  const [vis, setVis] = useState<Visibility>("public");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const p = await post<Project>("/projects", { name: name.trim(), description: desc.trim(), modality: tpl?.modality ?? modality, visibility: vis });
      // Tạo từ mẫu: chép tập nhãn + hướng dẫn sang dự án, không tham chiếu mẫu (mục 17.10).
      if (tpl?.labelSchema) await put(`/projects/${p.id}/label-schema`, { ...tpl.labelSchema, modality: tpl.modality });
      if (tpl?.guidelineMarkdown) await put(`/projects/${p.id}/guideline`, { markdown: tpl.guidelineMarkdown, examples: [] });
      toast.success("Đã tạo dự án");
      router.push(`/du-an/${p.id}?tab=cau-hinh`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Tạo dự án" description="Loại dữ liệu không đổi được sau khi tạo — nó quyết định loại file và công cụ dùng được." back={{ href: "/du-an", label: "Dự án của tôi" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Tên dự án" required hint="Tối đa 200 ký tự">
              <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Phân loại phương tiện giao thông" />
            </Field>
            <Field label="Mô tả">
              <Textarea rows={3} value={desc} maxLength={5000} onChange={(e) => setDesc(e.target.value)} />
            </Field>
            <div className="space-y-2">
              <span className="text-sm font-medium">Loại dữ liệu {tpl && <span className="text-xs text-muted-foreground">(theo mẫu)</span>}</span>
              <RadioGroup value={tpl?.modality ?? modality} onValueChange={(v) => setModality(v as Modality)} className="grid grid-cols-2 gap-2 sm:grid-cols-3" disabled={Boolean(tpl)}>
                {(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                    <RadioGroupItem value={m} /> {MODALITY_LABEL[m]}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Ai được tham gia</span>
              <RadioGroup value={vis} onValueChange={(v) => setVis(v as Visibility)} className="space-y-1.5">
                {(Object.keys(VIS_HINT) as Visibility[]).map((v) => (
                  <label key={v} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
                    <RadioGroupItem value={v} className="mt-0.5" />
                    <span>
                      <span className="font-medium">{VISIBILITY_LABEL[v]}</span>
                      <span className="block text-xs text-muted-foreground">{VIS_HINT[v]}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <Button onClick={() => void create()} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />} Tạo dự án nháp
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="size-4" /> Bắt đầu từ mẫu
            </CardTitle>
            <CardDescription>Điền sẵn tập nhãn và hướng dẫn; sửa được sau.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button type="button" onClick={() => setTpl(null)} className={cn("w-full rounded-md border p-3 text-left text-sm", !tpl && "border-primary bg-primary/5")}>
              Dự án trống
            </button>
            {(templates.data ?? []).map((t) => (
              <button key={t.id} type="button" onClick={() => setTpl(t)} className={cn("w-full rounded-md border p-3 text-left text-sm", tpl?.id === t.id && "border-primary bg-primary/5")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.name}</span>
                  {tpl?.id === t.id && <Check className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <p className="mt-1 text-xs">
                  {MODALITY_LABEL[t.modality]} · {(t.labelSchema?.tools ?? []).map((x) => TOOL_LABEL[x.kind]).join(", ")}
                  {t.suggestedUnitPriceVnd ? ` · tham khảo ~${formatVnd(t.suggestedUnitPriceVnd)}/câu (thưởng ≈ giá × số câu)` : ""}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
