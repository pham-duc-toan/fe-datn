"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, GitMerge, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { Loading, ErrorState } from "@/components/common/states";
import { ToneBadge } from "@/components/common/status-badge";
import { TAG_KIND_LABEL, useTags } from "@/hooks/use-tags";
import { post, put } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Tag, TagKind } from "@/lib/types";

/**
 * Danh mục thẻ lĩnh vực / ngôn ngữ. Hồ sơ kỹ năng và dự án lưu MÃ thẻ — đổi tên không đụng dữ liệu đã gắn;
 * ẩn = không cho chọn mới; gộp = mọi nơi đang gắn thẻ này chuyển sang thẻ đích (không hoàn tác).
 */
export default function TagsAdminPage() {
  const qc = useQueryClient();
  const { query, tags, name } = useTags();
  const [kind, setKind] = useState<TagKind>("domain");
  const [filter, setFilter] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tags"] });

  const f = filter.trim().toLowerCase();
  const rows = tags
    .filter((t) => t.kind === kind && (!f || t.name.toLowerCase().includes(f) || t.code.includes(f)))
    .sort((a, b) => Number(Boolean(a.mergedInto)) - Number(Boolean(b.mergedInto)) || Number(a.hidden) - Number(b.hidden) || a.name.localeCompare(b.name, "vi"));
  const targets = (t: Tag) =>
    tags
      .filter((x) => x.kind === t.kind && x.id !== t.id && !x.mergedInto)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((x) => ({ value: x.id, label: `${x.name} (${x.code})` }));

  return (
    <>
      <PageHeader
        title="Thẻ lĩnh vực & ngôn ngữ"
        description="Labeler chọn thẻ cho hồ sơ kỹ năng, doanh nghiệp chọn thẻ cho dự án; gợi ý dự án tính theo số thẻ trùng nhau."
        actions={
          <ActionDialog
            key={kind}
            trigger={
              <Button>
                <Plus /> Thẻ mới
              </Button>
            }
            title={`Thêm thẻ ${TAG_KIND_LABEL[kind].toLowerCase()}`}
            description="Mã thẻ không đổi được sau khi tạo; bỏ trống thì tự sinh từ tên (bỏ dấu, nối bằng “-”)."
            fields={[
              { name: "name", label: "Tên hiển thị", required: true, placeholder: kind === "domain" ? "Y tế" : "Tiếng Việt" },
              { name: "code", label: "Mã", placeholder: kind === "domain" ? "y-te" : "vi", hint: kind === "language" ? "Nên dùng mã ISO 639-1: vi, en, ja…" : undefined },
            ]}
            confirmLabel="Thêm"
            successMessage="Đã thêm thẻ"
            onConfirm={async (v) => {
              await post("/admin/tags", { kind, name: v.name, code: v.code || null });
              await refresh();
            }}
          />
        }
      />
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={kind} onValueChange={(v) => setKind(v as TagKind)}>
              <TabsList>
                <TabsTrigger value="domain">Lĩnh vực</TabsTrigger>
                <TabsTrigger value="language">Ngôn ngữ</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc theo tên / mã" className="max-w-xs" />
          </div>
          <CardTitle className="sr-only">{TAG_KIND_LABEL[kind]}</CardTitle>
          <CardDescription>
            Đổi tên chỉ đổi chữ hiển thị. Ẩn: không ai chọn mới được, nơi đã gắn vẫn giữ. Gộp: dành cho thẻ trùng nghĩa (vd “Y khoa” vào “Y tế”) — hồ sơ và dự án đang gắn được chuyển sang thẻ đích.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error} />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{f ? "Không có thẻ khớp." : "Chưa có thẻ nào."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} className={t.mergedInto ? "text-muted-foreground" : undefined}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell>
                      {t.mergedInto ? (
                        <ToneBadge tone="muted">đã gộp vào {name(t.kind, t.mergedInto)}</ToneBadge>
                      ) : t.hidden ? (
                        <ToneBadge tone="warning">đang ẩn</ToneBadge>
                      ) : (
                        <ToneBadge tone="success">đang dùng</ToneBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(t.updatedAt)}</TableCell>
                    <TableCell>
                      {!t.mergedInto && (
                        <div className="flex justify-end gap-1">
                          <ActionDialog
                            trigger={
                              <Button size="icon-sm" variant="ghost" aria-label="Đổi tên" title="Đổi tên">
                                <Pencil />
                              </Button>
                            }
                            title="Đổi tên thẻ"
                            description={`Mã “${t.code}” giữ nguyên — hồ sơ và dự án đã gắn tự hiện tên mới.`}
                            fields={[{ name: "name", label: "Tên hiển thị", required: true, defaultValue: t.name }]}
                            confirmLabel="Lưu"
                            successMessage="Đã đổi tên"
                            onConfirm={async (v) => {
                              await put(`/admin/tags/${t.id}`, { name: v.name });
                              await refresh();
                            }}
                          />
                          <ActionDialog
                            trigger={
                              <Button size="icon-sm" variant="ghost" aria-label={t.hidden ? "Hiện lại" : "Ẩn"} title={t.hidden ? "Hiện lại" : "Ẩn"}>
                                {t.hidden ? <Eye /> : <EyeOff />}
                              </Button>
                            }
                            title={t.hidden ? `Hiện lại “${t.name}”?` : `Ẩn “${t.name}”?`}
                            description={t.hidden ? "Thẻ lại xuất hiện trong ô chọn." : "Không ai chọn mới được; hồ sơ và dự án đã gắn vẫn giữ thẻ."}
                            confirmLabel={t.hidden ? "Hiện lại" : "Ẩn"}
                            successMessage={t.hidden ? "Đã hiện lại thẻ" : "Đã ẩn thẻ"}
                            onConfirm={async () => {
                              await post(`/admin/tags/${t.id}/${t.hidden ? "show" : "hide"}`, {});
                              await refresh();
                            }}
                          />
                          <ActionDialog
                            trigger={
                              <Button size="icon-sm" variant="ghost" aria-label="Gộp vào thẻ khác" title="Gộp vào thẻ khác">
                                <GitMerge />
                              </Button>
                            }
                            title={`Gộp “${t.name}” vào thẻ khác`}
                            description="Mọi hồ sơ kỹ năng và dự án đang gắn thẻ này sẽ chuyển sang thẻ đích. Không hoàn tác được."
                            fields={[{ name: "targetId", label: "Thẻ đích", type: "select", required: true, options: targets(t) }]}
                            confirmLabel="Gộp"
                            destructive
                            successMessage="Đã gộp thẻ"
                            onConfirm={async (v) => {
                              await post(`/admin/tags/${t.id}/merge`, { targetId: v.targetId });
                              await refresh();
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
