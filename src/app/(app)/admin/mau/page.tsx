"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/misc";
import { QueryState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { SchemaEditor } from "@/components/project/schema-editor";
import { api, post, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatVnd } from "@/lib/format";
import { MODALITY_LABEL, TOOL_LABEL } from "@/lib/labels";
import type { LabelSchema, Modality, Template } from "@/lib/types";

type Form = { id: string | null; code: string; name: string; description: string; modality: Modality; schema: LabelSchema; guideline: string; price: string; redundancy: string };

const empty = (): Form => ({ id: null, code: "", name: "", description: "", modality: "image", schema: { modality: "image", tools: [] }, guideline: "", price: "", redundancy: "" });

export default function TemplatesAdminPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-templates"], queryFn: () => api<Template[]>("/admin/templates") });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const body = {
        code: form.code,
        name: form.name,
        description: form.description,
        labelSchema: { ...form.schema, modality: form.modality },
        guidelineMarkdown: form.guideline,
        suggestedUnitPriceVnd: form.price ? Number(form.price) : null,
        suggestedRedundancy: form.redundancy ? Number(form.redundancy) : null,
      };
      if (form.id) await put(`/admin/templates/${form.id}`, body);
      else await post("/admin/templates", body);
      toast.success("Đã lưu mẫu");
      setForm(null);
      await qc.invalidateQueries({ queryKey: ["admin-templates"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Mẫu bài toán"
        description="Doanh nghiệp tạo dự án từ mẫu (chép tập nhãn + hướng dẫn); sửa mẫu không đổi dự án đã tạo."
        actions={
          <Button onClick={() => setForm(empty())}>
            <Plus /> Mẫu mới
          </Button>
        }
      />
      {form && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{form.id ? "Sửa mẫu" : "Mẫu mới"}</CardTitle>
            <CardDescription>Tập nhãn được kiểm bằng chính bộ đọc tập nhãn của dự án.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mã (code)" hint="a-z, 0-9, -">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Tên">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Loại dữ liệu">
                <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v as Modality, schema: { ...form.schema, modality: v as Modality } })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODALITY_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mô tả" className="sm:col-span-3">
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Đơn giá gợi ý (đ)">
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Số người gán gợi ý">
                <Input type="number" value={form.redundancy} onChange={(e) => setForm({ ...form, redundancy: e.target.value })} />
              </Field>
            </div>
            <SchemaEditor modality={form.modality} value={form.schema} onChange={(s) => setForm({ ...form, schema: s })} />
            <Field label="Hướng dẫn (markdown)">
              <Textarea rows={6} className="font-mono text-sm" value={form.guideline} onChange={(e) => setForm({ ...form, guideline: e.target.value })} />
            </Field>
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={busy || !form.code || !form.name}>
                {busy && <Loader2 className="animate-spin" />} Lưu
              </Button>
              <Button variant="outline" onClick={() => setForm(null)}>
                Huỷ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="py-0">
        <CardContent className="px-0">
          <QueryState query={q} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Mẫu</TableHead>
                    <TableHead>Loại dữ liệu</TableHead>
                    <TableHead>Công cụ</TableHead>
                    <TableHead>Gợi ý</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.code} · v{t.version} · {formatDateTime(t.updatedAt)}
                        </div>
                      </TableCell>
                      <TableCell>{MODALITY_LABEL[t.modality]}</TableCell>
                      <TableCell className="text-sm">{(t.labelSchema?.tools ?? []).map((x) => TOOL_LABEL[x.kind]).join(", ")}</TableCell>
                      <TableCell className="text-sm">
                        {t.suggestedUnitPriceVnd ? formatVnd(t.suggestedUnitPriceVnd) : "—"} {t.suggestedRedundancy ? `× ${t.suggestedRedundancy}` : ""}
                      </TableCell>
                      <TableCell>{t.active ? <ToneBadge tone="success">Đang bật</ToneBadge> : <ToneBadge tone="muted">Đã tắt</ToneBadge>}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              setForm({
                                id: t.id,
                                code: t.code,
                                name: t.name,
                                description: t.description,
                                modality: t.modality,
                                schema: { ...(t.labelSchema ?? { tools: [] }), modality: t.modality } as LabelSchema,
                                guideline: t.guidelineMarkdown,
                                price: t.suggestedUnitPriceVnd?.toString() ?? "",
                                redundancy: t.suggestedRedundancy?.toString() ?? "",
                              })
                            }
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await post(`/admin/templates/${t.id}/${t.active ? "deactivate" : "activate"}`);
                                await qc.invalidateQueries({ queryKey: ["admin-templates"] });
                              } catch (e) {
                                toast.error(errorMessage(e));
                              }
                            }}
                          >
                            <Power /> {t.active ? "Tắt" : "Bật"}
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
    </>
  );
}
