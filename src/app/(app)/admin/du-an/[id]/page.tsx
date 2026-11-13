"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { ActionDialog } from "@/components/common/action-dialog";
import { KeyValue } from "@/components/common/misc";
import { Pager } from "@/components/common/pager";
import { QueryState } from "@/components/common/states";
import { StatusBadge, ToneBadge } from "@/components/common/status-badge";
import { UserName } from "@/components/common/user-name";
import { PendingTile } from "@/components/project/data-tab";
import { SampleThumb } from "@/components/project/data-tab";
import { useSamples } from "@/hooks/use-samples";
import { api, post } from "@/lib/api";
import { describeLabel } from "@/lib/describe";
import { errorMessage } from "@/lib/errors";
import { formatBytes, formatDateTime, formatNumber, formatVnd } from "@/lib/format";
import { MEMBER_ROLE, MODALITY_LABEL, projectStatus, READINESS_LABEL, READINESS_WARNING, TOOL_LABEL, VISIBILITY_LABEL } from "@/lib/labels";
import type { GoldItem, IngestStatus, Member, Paged, Project, Readiness, Sample, Tool } from "@/lib/types";
import { useUrlPage } from "@/lib/use-url-state";

const yesNo = (b: boolean | null | undefined) => (b ? "Có" : "Không");

function toolDetail(t: Tool): string {
  const parts: string[] = [];
  if (t.classes?.length) parts.push(`lớp: ${t.classes.join(", ")}`);
  if (t.allowMultiple) parts.push("chọn nhiều");
  if (t.required === false) parts.push("không bắt buộc");
  if (t.minItems != null || t.maxItems != null) parts.push(`số lượng ${t.minItems ?? 0}–${t.maxItems ?? "∞"}`);
  if (t.maxLength) parts.push(`tối đa ${t.maxLength} ký tự`);
  if (t.min != null || t.max != null) parts.push(`khoảng ${t.min ?? "−∞"}…${t.max ?? "∞"}${t.integer ? " (số nguyên)" : ""}${t.tolerance ? `, sai số ${t.tolerance}` : ""}`);
  if (t.allowTie) parts.push("cho phép hoà");
  if (t.matchThreshold != null) parts.push(`ngưỡng khớp ${t.matchThreshold}`);
  if (t.attributes?.length) parts.push(`thuộc tính: ${t.attributes.map((a) => `${a.name}${a.required ? "*" : ""}`).join(", ")}`);
  if (t.spanTool) parts.push(`đoạn nguồn: ${t.spanTool}`);
  return parts.join(" · ");
}

/**
 * Chi tiết ĐẦY ĐỦ một dự án cho admin duyệt: mọi thông tin chủ dự án đã khai (thông tin, tài chính, kênh, điều kiện,
 * tập nhãn, hướng dẫn) cùng dữ liệu thật đã nạp (mẫu + trạng thái xử lý), câu vàng và thành viên — để duyệt có căn cứ.
 */
export default function AdminProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const project = useQuery({ queryKey: ["admin-project", id], queryFn: () => api<Project>(`/projects/${id}`) });
  const readiness = useQuery({ queryKey: ["readiness", id], queryFn: () => api<Readiness>(`/projects/${id}/readiness`) });
  const status = useQuery({ queryKey: ["sample-status", id], queryFn: () => api<IngestStatus>(`/projects/${id}/samples/status`) });
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["admin-project", id] });
    void qc.invalidateQueries({ queryKey: ["pending-projects"] });
  };

  return (
    <QueryState query={project}>
      {(p) => (
        <>
          <PageHeader
            back={{ href: "/admin/du-an", label: "Dự án chờ duyệt" }}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {p.name} <StatusBadge entry={projectStatus(p.status)} />
              </span>
            }
            description={
              <span>
                {MODALITY_LABEL[p.modality]} · {VISIBILITY_LABEL[p.visibility]} · chủ dự án <UserName id={p.ownerId} />
              </span>
            }
            actions={
              p.status === "pendingApproval" && (
                <>
                  <Button
                    onClick={async () => {
                      try {
                        await post(`/projects/${p.id}/approve`);
                        toast.success("Đã duyệt — dự án bắt đầu chạy");
                        done();
                        router.push("/admin/du-an");
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    <Check /> Duyệt
                  </Button>
                  <ActionDialog
                    trigger={
                      <Button variant="destructive">
                        <X /> Từ chối
                      </Button>
                    }
                    title="Từ chối dự án"
                    description="Dự án bị huỷ, ký quỹ hoàn về doanh nghiệp."
                    destructive
                    fields={[{ name: "reason", label: "Lý do", type: "textarea", required: true }]}
                    onConfirm={async (v) => {
                      await post(`/projects/${p.id}/reject`, { reason: v.reason });
                      done();
                      router.push("/admin/du-an");
                    }}
                  />
                </>
              )
            }
          />

          <ReadinessBanner readiness={readiness.data} status={status.data} />

          <Tabs defaultValue="tong-quan">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
              <TabsTrigger value="cau-hinh">Cấu hình & tài chính</TabsTrigger>
              <TabsTrigger value="nhan">Tập nhãn & hướng dẫn</TabsTrigger>
              <TabsTrigger value="du-lieu">Dữ liệu ({status.data?.ready ?? "…"})</TabsTrigger>
              <TabsTrigger value="cau-vang">Câu vàng</TabsTrigger>
              <TabsTrigger value="thanh-vien">Thành viên</TabsTrigger>
            </TabsList>
            <div className="mt-5">
              <TabsContent value="tong-quan">
                <OverviewPanel p={p} />
              </TabsContent>
              <TabsContent value="cau-hinh">
                <ConfigPanel p={p} readiness={readiness.data} />
              </TabsContent>
              <TabsContent value="nhan">
                <SchemaPanel p={p} />
              </TabsContent>
              <TabsContent value="du-lieu">
                <DataPanel p={p} status={status.data} />
              </TabsContent>
              <TabsContent value="cau-vang">
                <GoldPanel p={p} />
              </TabsContent>
              <TabsContent value="thanh-vien">
                <MembersPanel p={p} />
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </QueryState>
  );
}

/** Dòng tóm tắt đầu trang: dữ liệu đã xử lý xong chưa, còn thiếu gì — admin biết ngay dự án có đủ điều kiện duyệt không. */
function ReadinessBanner({ readiness: r, status: st }: { readiness?: Readiness; status?: IngestStatus }) {
  if (!r) return null;
  const dang = st ? st.queued + st.processing : 0;
  if (dang > 0 || r.videoPreparingCount > 0)
    return (
      <Alert className="mb-4">
        <Loader2 className="animate-spin" />
        <AlertTitle>Dữ liệu còn đang xử lý</AlertTitle>
        <AlertDescription>
          {dang > 0 && `${dang} file đang xử lý. `}
          {r.videoPreparingCount > 0 && `${r.videoPreparingCount} video đang chuẩn bị bản xem. `}Nên chờ xong rồi mới duyệt.
        </AlertDescription>
      </Alert>
    );
  if (r.missing.length > 0)
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle />
        <AlertTitle>Dự án còn thiếu</AlertTitle>
        <AlertDescription>{r.missing.map((m) => READINESS_LABEL[m] ?? m).join(" · ")}</AlertDescription>
      </Alert>
    );
  return (
    <Alert className="mb-4">
      <CheckCircle2 className="text-emerald-600" />
      <AlertTitle>Đủ điều kiện</AlertTitle>
      <AlertDescription>
        {formatNumber(r.questionCount)} câu thật + {formatNumber(r.qualityGoldCount)} câu kiểm tra, dữ liệu đã xử lý xong.
        {r.warnings.length > 0 && ` Lưu ý: ${r.warnings.map((w) => READINESS_WARNING[w] ?? w).join(" · ")}`}
      </AlertDescription>
    </Alert>
  );
}

function OverviewPanel({ p }: { p: Project }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin dự án</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">{p.description || <span className="text-muted-foreground">Không có mô tả.</span>}</p>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Mã dự án", <span key="id" className="font-mono text-xs">{p.id}</span>],
              ["Loại dữ liệu", MODALITY_LABEL[p.modality]],
              ["Chế độ", VISIBILITY_LABEL[p.visibility]],
              ["Chủ dự án", <UserName key="o" id={p.ownerId} />],
              ["Chủ đề", p.domains.length ? p.domains.join(", ") : "—"],
              ["Ngôn ngữ", p.languages.length ? p.languages.join(", ") : "—"],
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mốc thời gian</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Tạo lúc", formatDateTime(p.createdAt)],
              ["Cập nhật", formatDateTime(p.updatedAt)],
              ["Publish lúc", formatDateTime(p.publishedAt)],
              ["Hạn chót nộp bài", formatDateTime(p.deadline)],
              ["Yêu cầu kết thúc", formatDateTime(p.finishRequestedAt)],
              ["Bắt đầu chấm", formatDateTime(p.gradingStartedAt)],
              ["Đóng", formatDateTime(p.closedAt)],
            ]}
          />
          {p.statusReason && <p className="mt-3 text-sm text-muted-foreground">Ghi chú trạng thái: {p.statusReason}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigPanel({ p, readiness: r }: { p: Project; readiness?: Readiness }) {
  const feePerPass = r?.platformFeePerPassVnd;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Thưởng, suất và chấm bài</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Thưởng mỗi bài đạt", formatVnd(p.rewardVnd)],
              ["Số suất thưởng", formatNumber(p.slots)],
              ["Phí nền tảng", p.platformFeePercent != null ? `${p.platformFeePercent}%${feePerPass != null ? ` (${formatVnd(feePerPass)} / bài đạt)` : ""}` : r ? `${r.platformFeePercent}% (hiện hành)` : "—"],
              ["Ký quỹ", p.escrowVnd != null ? formatVnd(p.escrowVnd) : r ? `${formatVnd(r.estimatedCostVnd)} (ước tính)` : "—"],
              ["Số câu một bài", `${formatNumber(p.questionCount)} câu thật${r ? ` + ${formatNumber(r.qualityGoldCount)} câu kiểm tra` : ""}`],
              ["Đạt khi giống đa số", `≥ ${p.passThresholdPercent}%`],
              ["Lấp suất trống", p.fillSlotsMinPercent != null ? `Có, từ ${p.fillSlotsMinPercent}%` : "Không"],
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kênh thu thập</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Kênh chuyên nghiệp", yesNo(p.allowProfessional)],
              ["Cổng vượt link", yesNo(p.allowLinkGateway)],
              ["Đơn giá nhãn khách vãng lai", p.allowLinkGateway ? `${formatVnd(p.gateUnitPriceVnd)} / nhãn (admin đặt)` : "—"],
              ["Ngân sách cổng link", p.allowLinkGateway ? formatVnd(p.gateBudgetVnd) : "—"],
              ["Gán nhãn cộng tác", yesNo(p.allowCollaborative)],
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Điều kiện tham gia</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Cấp độ tối thiểu", p.minLevel ?? "Không yêu cầu"],
              ["Uy tín tối thiểu", p.minReputation ?? "Không yêu cầu"],
              ["Xác minh danh tính", yesNo(p.requireVerifiedIdentity)],
              ["Bài test đầu vào", p.requireEntranceTest ? `Có — ${p.entranceQuestionCount} câu, đạt ≥ ${p.entrancePassPercent}%` : "Không"],
              ["Cần đồng ý điều khoản cá nhân", yesNo(p.consentRequired)],
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bảo vệ dữ liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            className="sm:grid-cols-1"
            items={[
              ["Nội dung nhạy cảm", yesNo(p.sensitiveContent)],
              ["Cảnh báo nội dung", p.contentWarning || "—"],
              ["Ký NDA", p.ndaRequired ? `Có (phiên bản ${p.ndaVersion})` : "Không"],
              ["Xoá file sau khi đóng", yesNo(p.deleteFilesAfterClose)],
              ["File đã xoá lúc", formatDateTime(p.filesPurgedAt)],
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SchemaPanel({ p }: { p: Project }) {
  const tools = p.labelSchema?.tools ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tập nhãn ({tools.length} công cụ)</CardTitle>
          {p.labelSchema?.segmentSeconds ? <CardDescription>Cắt âm thanh / video thành đoạn {p.labelSchema.segmentSeconds} giây.</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa đặt tập nhãn.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {tools.map((t) => (
                <li key={t.name} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <ToneBadge tone="info">{TOOL_LABEL[t.kind]}</ToneBadge>
                  </div>
                  {toolDetail(t) && <p className="mt-1 text-muted-foreground">{toolDetail(t)}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Câu hỏi chung</CardTitle>
          <CardDescription>Người làm thấy câu này ở đầu mỗi câu; mẫu có câu hỏi riêng thì hiện câu riêng thay thế.</CardDescription>
        </CardHeader>
        <CardContent>
          {p.labelSchema?.question ? (
            <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{p.labelSchema.question}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa đặt câu hỏi chung.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DataPanel({ p, status }: { p: Project; status?: IngestStatus }) {
  const [page, setPage] = useUrlPage();
  const samples = useQuery({
    queryKey: ["admin-samples", p.id, page],
    queryFn: () => api<Paged<Sample>>(`/projects/${p.id}/samples`, { query: { page, pageSize: 24 } }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dữ liệu đã nạp</CardTitle>
        <CardDescription>
          {status
            ? `Đã xử lý ${formatNumber(status.ready)} · chờ ${status.queued} · đang xử lý ${status.processing} · lỗi ${status.failed}${status.preparingVideo ? ` · video đang chuẩn bị ${status.preparingVideo}` : ""}.`
            : "Đang tải…"}{" "}
          Bản gốc, không watermark (chỉ admin và chủ dự án xem được).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={samples} empty={(d) => d.items.length === 0}>
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {d.items.map((s) => (
                  <div key={s.id} className="space-y-1 rounded-md border p-1.5">
                    {s.ingestState !== "ready" ? <PendingTile s={s} /> : <SampleThumb s={s} />}
                    <p className="truncate text-xs" title={s.originalName}>
                      {s.originalName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.metadata.width ? `${s.metadata.width}×${s.metadata.height}` : s.metadata.durationSec ? `${s.metadata.durationSec}s` : ""} {formatBytes(s.sizeBytes)}
                    </p>
                  </div>
                ))}
              </div>
              <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function GoldPanel({ p }: { p: Project }) {
  const gold = useQuery({ queryKey: ["gold", p.id], queryFn: () => api<GoldItem[]>(`/projects/${p.id}/gold-items`) });
  const { samples: info } = useSamples(p.id, (gold.data ?? []).map((g) => g.sampleId));
  const schema = p.labelSchema;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Câu hỏi vàng ({gold.data?.length ?? 0})</CardTitle>
        <CardDescription>Mẫu có sẵn đáp án đúng. “Kiểm tra chất lượng” chen vào mọi bài làm; “Bài test đầu vào” dùng cho bài test trước khi tham gia.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={gold} empty={(d) => d.length === 0}>
          {(d) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mẫu</TableHead>
                  <TableHead>Mục đích</TableHead>
                  <TableHead>Đáp án đúng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.map((g) => {
                  const s = info.get(g.sampleId);
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="w-48">{s ? <SampleThumb s={s} /> : <span className="text-xs text-muted-foreground">…</span>}</TableCell>
                      <TableCell>{g.purpose === "qualityCheck" ? "Kiểm tra chất lượng" : "Bài test đầu vào"}</TableCell>
                      <TableCell className="text-sm">
                        {schema ? (
                          <ul className="space-y-0.5">
                            {describeLabel(schema, g.expectedPayload.data, s?.content).map((x) => (
                              <li key={x.tool}>
                                <span className="text-muted-foreground">{x.tool}:</span> {x.text}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function MembersPanel({ p }: { p: Project }) {
  const members = useQuery({ queryKey: ["members", p.id], queryFn: () => api<Member[]>(`/projects/${p.id}/members`) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thành viên ({members.data?.length ?? 0})</CardTitle>
        <CardDescription>
          Chủ dự án và người đã tham gia.{" "}
          <Link href={`/admin/nguoi-dung`} className="underline">
            Tra người dùng
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={members} empty={(d) => d.length === 0}>
          {(d) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tham gia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <UserName id={m.userId} />
                    </TableCell>
                    <TableCell>{MEMBER_ROLE[m.role] ?? m.role}</TableCell>
                    <TableCell>{m.state === "active" ? "Đang hoạt động" : "Bị chặn"}</TableCell>
                    <TableCell>{formatDateTime(m.joinedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
